// Package userarchive implements portable, user-scoped personal data snapshots.
package userarchive

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/webhook"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Adapter handles SQL placeholders and generated identifiers for supported databases.
type Adapter struct {
	DB      *sql.DB
	Dialect string
}

type tableSpec struct{ name, table, owner, columns, filter string }

// Identifiers come exclusively from this list, never from archive input.
func tables() []tableSpec {
	return []tableSpec{
		{"profile", "user", "id", "nickname,email,avatar_url,description", ""},
		{"settings", "user_setting", "user_id", "key,value", ""},
		{"wallets", "finance_wallet", "creator_id", "id,uid,created_ts,updated_ts,row_status,name,initial_balance_minor,balance_minor,allow_negative_balance,deleted_ts", ""},
		{"categories", "finance_category", "creator_id", "id,uid,created_ts,updated_ts,row_status,name,type,emoji", ""},
		{"transactions", "finance_transaction", "creator_id", "id,uid,created_ts,updated_ts,occurred_ts,type,amount_minor,wallet_id,destination_wallet_id,category_id,note,adjustment_delta_minor,balance_before_minor,balance_after_minor,voided_ts", ""},
		{"reminderLists", "reminder_list", "creator_id", "id,uid,created_ts,updated_ts,row_status,name,color,icon,sort_order", ""},
		{"reminders", "reminder", "creator_id", "id,uid,list_id,memo_id,created_ts,updated_ts,row_status,title,due_date,remind_ts,time_zone,advance_notice_seconds,recurrence_type,recurrence_interval,recurrence_weekdays,recurrence_end_date,recurrence_max_occurrences,completed_occurrences,flagged,priority,tags,location_placeholder,location_latitude,location_longitude,location_radius_meters,location_trigger,status,completed_ts,sort_order,early_notified_ts,notified_ts", ""},
		{"occurrences", "reminder_occurrence", "creator_id", "id,uid,reminder_uid,list_uid,list_name,title,memo_uid,created_ts,scheduled_date,remind_ts,completed_ts,completion_date,resolved_ts,status", ""},
		{"moodHistory", "memo_mood_history", "creator_id", "memo_id,memo_uid,created_ts,mood_level,deleted_ts", " AND deleted_ts IS NOT NULL"},
		{"notifications", "inbox", "receiver_id", "id,created_ts,sender_id,status,message", ""},
	}
}

func allowedSetting(key any) bool {
	switch key {
	case "GENERAL", "TAGS", "PERSONA", "MEMO_VIEWS", "WEBHOOKS":
		return true
	}
	return false
}

func (a Adapter) quote(value string) string {
	if a.Dialect == "mysql" {
		return "`" + value + "`"
	}
	return `"` + value + `"`
}
func (a Adapter) bind(query string) string {
	index := 0
	if a.Dialect != "postgres" {
		return query
	}
	return replaceBinds(query, &index)
}
func replaceBinds(query string, index *int) string {
	var out strings.Builder
	for _, c := range query {
		if c == '?' {
			*index++
			out.WriteString("$" + strconv.Itoa(*index))
		} else {
			out.WriteRune(c)
		}
	}
	return out.String()
}
func (a Adapter) columns(columns string) string {
	names := strings.Split(columns, ",")
	for n := range names {
		names[n] = a.quote(names[n])
	}
	return strings.Join(names, ",")
}

// Export captures personal tables in one read transaction and excludes login credentials.
func (a Adapter) Export(ctx context.Context, userID int32) (*store.UserArchiveData, error) {
	tx, err := a.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	data := &store.UserArchiveData{Version: 1, Tables: map[string][]store.UserArchiveRow{}, SourceUserID: userID}
	for _, spec := range tables() {
		records, err := a.exportTable(ctx, tx, spec, userID)
		if err != nil {
			return nil, err
		}
		data.Tables[spec.name] = records
	}
	data.SenderUsernames, err = a.exportSenders(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	return data, tx.Commit()
}

func (a Adapter) exportTable(ctx context.Context, tx *sql.Tx, spec tableSpec, userID int32) ([]store.UserArchiveRow, error) {
	selectColumns := a.columns(spec.columns)
	if a.Dialect == "mysql" && spec.name == "notifications" {
		selectColumns = strings.Replace(selectColumns, "`created_ts`", "UNIX_TIMESTAMP(`created_ts`)", 1)
	}
	columns := strings.Split(spec.columns, ",")
	rows, err := tx.QueryContext(ctx, a.bind("SELECT "+selectColumns+" FROM "+a.quote(spec.table)+" WHERE "+a.quote(spec.owner)+" = ?"+spec.filter+" ORDER BY "+a.quote(columns[0])), userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []store.UserArchiveRow{}
	for rows.Next() {
		values := make([]any, len(columns))
		targets := make([]any, len(columns))
		for n := range values {
			targets[n] = &values[n]
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, err
		}
		row := store.UserArchiveRow{}
		for n, column := range columns {
			if raw, ok := values[n].([]byte); ok {
				values[n] = string(raw)
			}
			row[column] = values[n]
		}
		if spec.name == "settings" && !allowedSetting(row["key"]) {
			continue
		}
		records = append(records, row)
	}
	return records, rows.Err()
}

func (a Adapter) exportSenders(ctx context.Context, tx *sql.Tx, userID int32) (map[string]string, error) {
	rows, err := tx.QueryContext(ctx, a.bind("SELECT DISTINCT u.id,u.username FROM "+a.quote("user")+" u JOIN inbox i ON i.sender_id = u.id WHERE i.receiver_id = ?"), userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	senders := map[string]string{}
	for rows.Next() {
		var id int64
		var username string
		if err := rows.Scan(&id, &username); err != nil {
			return nil, err
		}
		senders[strconv.FormatInt(id, 10)] = username
	}
	return senders, rows.Err()
}

func number(value any) (int64, error) {
	switch v := value.(type) {
	case int64:
		return v, nil
	case json.Number:
		return v.Int64()
	case string:
		return strconv.ParseInt(v, 10, 64)
	}
	return 0, errors.New("integer required")
}

// Validate rejects unknown tables, credentials, invalid identifiers and missing columns before writing memos.
func Validate(data *store.UserArchiveData) error {
	if data == nil || data.Version != 1 {
		return errors.New("unsupported user data version")
	}
	known := map[string]bool{}
	for _, spec := range tables() {
		known[spec.name] = true
		if _, exists := data.Tables[spec.name]; !exists {
			return errors.Errorf("missing user data table %s", spec.name)
		}
		columns := strings.Split(spec.columns, ",")
		seen := map[int64]bool{}
		for _, row := range data.Tables[spec.name] {
			if len(row) != len(columns) {
				return errors.Errorf("invalid columns in %s", spec.name)
			}
			for _, column := range columns {
				v, ok := row[column]
				if !ok {
					return errors.Errorf("missing %s.%s", spec.name, column)
				}
				switch v.(type) {
				case nil, string, int64, float64, bool, json.Number:
				default:
					return errors.New("column must be scalar")
				}
			}
			if status, exists := row["row_status"]; exists && status != string(store.Normal) && status != string(store.Archived) {
				return errors.Errorf("invalid row status in %s", spec.name)
			}
			if v, ok := row["id"]; ok {
				id, err := number(v)
				if err != nil || id <= 0 || seen[id] {
					return errors.Errorf("invalid or duplicate ID in %s", spec.name)
				}
				seen[id] = true
			}
			if spec.name == "settings" && !allowedSetting(row["key"]) {
				return errors.New("unsupported user setting")
			}
			if spec.name == "settings" {
				value, ok := row["value"].(string)
				if !ok {
					return errors.New("user setting value must be JSON text")
				}
				var message proto.Message
				switch row["key"] {
				case "GENERAL":
					message = &storepb.GeneralUserSetting{}
				case "TAGS":
					message = &storepb.TagsUserSetting{}
				case "PERSONA":
					message = &storepb.PersonaUserSetting{}
				case "MEMO_VIEWS":
					message = &storepb.MemoViewsUserSetting{}
				case "WEBHOOKS":
					message = &storepb.WebhooksUserSetting{}
				}
				if err := protojson.Unmarshal([]byte(value), message); err != nil {
					return errors.Wrap(err, "invalid user preferences")
				}
				if hooks, ok := message.(*storepb.WebhooksUserSetting); ok {
					for _, hook := range hooks.Webhooks {
						if err := webhook.ValidateURL(hook.GetUrl()); err != nil {
							return errors.Wrap(err, "invalid webhook URL")
						}
						if err := webhook.ValidateSigningSecret(hook.GetSigningSecret()); err != nil {
							return errors.Wrap(err, "invalid webhook signing secret")
						}
					}
				}
			}
			for _, column := range []string{"name", "uid", "key", "value", "nickname", "email", "avatar_url", "description"} {
				if value, exists := row[column]; exists {
					if _, ok := value.(string); !ok {
						return errors.Errorf("%s.%s must be text", spec.name, column)
					}
				}
			}

		}
	}
	for name := range data.Tables {
		if !known[name] {
			return errors.Errorf("unsupported user data table %q", name)
		}
	}
	if len(data.Tables["profile"]) > 1 {
		return errors.New("duplicate profile")
	}
	// All foreign references must resolve inside this snapshot, before any memo writes.
	ids := map[string]map[int64]bool{}
	for _, name := range []string{"wallets", "categories", "reminderLists"} {
		ids[name] = map[int64]bool{}
		for _, row := range data.Tables[name] {
			id, _ := number(row["id"])
			ids[name][id] = true
		}
	}
	for _, name := range []string{"transactions", "reminders"} {
		for _, row := range data.Tables[name] {
			for column, table := range map[string]string{"wallet_id": "wallets", "destination_wallet_id": "wallets", "category_id": "categories", "list_id": "reminderLists"} {
				value, exists := row[column]
				if !exists || value == nil {
					continue
				}
				id, err := number(value)
				if err != nil || !ids[table][id] {
					return errors.Errorf("invalid %s.%s reference", name, column)
				}
			}
		}
	}
	return nil
}

func (a Adapter) insert(ctx context.Context, tx *sql.Tx, spec tableSpec, userID int32, row store.UserArchiveRow) (int32, error) {
	columns, args, placeholders := []string{a.quote(spec.owner)}, []any{userID}, []string{"?"}
	for _, column := range strings.Split(spec.columns, ",") {
		if column == "id" {
			continue
		}
		columns = append(columns, a.quote(column))
		args = append(args, row[column])
		placeholder := "?"
		if a.Dialect == "mysql" && spec.name == "notifications" && column == "created_ts" {
			placeholder = "FROM_UNIXTIME(?)"
		}
		placeholders = append(placeholders, placeholder)
	}
	query := "INSERT INTO " + a.quote(spec.table) + " (" + strings.Join(columns, ",") + ") VALUES (" + strings.Join(placeholders, ",") + ")"
	hasID := strings.HasPrefix(spec.columns, "id,")
	if a.Dialect == "postgres" && hasID {
		var id int32
		err := tx.QueryRowContext(ctx, a.bind(query+" RETURNING id"), args...).Scan(&id)
		return id, err
	}
	result, err := tx.ExecContext(ctx, a.bind(query), args...)
	if err != nil || !hasID {
		return 0, err
	}
	id, err := result.LastInsertId()
	return int32(id), err
}

// Import restores the personal snapshot in one transaction. SKIP retains an existing
// personal collection, REPLACE restores it, and DUPLICATE appends an independent copy.
func (a Adapter) Import(ctx context.Context, userID int32, data *store.UserArchiveData, policy string, memoIDs map[string]int32) (*store.UserArchiveResult, error) {
	if policy != "SKIP" && policy != "REPLACE" && policy != "DUPLICATE" {
		return nil, errors.New("invalid import conflict policy")
	}
	if err := Validate(data); err != nil {
		return nil, err
	}
	tx, err := a.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	result := &store.UserArchiveResult{}
	specs := tables()
	existing := 0
	for _, spec := range specs[2:] {
		var count int
		if err := tx.QueryRowContext(ctx, a.bind("SELECT COUNT(*) FROM "+a.quote(spec.table)+" WHERE "+a.quote(spec.owner)+" = ?"+spec.filter), userID).Scan(&count); err != nil {
			return nil, err
		}
		existing += count
	}
	skipPersonal := policy == "SKIP" && existing > 0
	if policy == "REPLACE" {
		for n := len(specs) - 1; n >= 2; n-- {
			spec := specs[n]
			if _, err := tx.ExecContext(ctx, a.bind("DELETE FROM "+a.quote(spec.table)+" WHERE "+a.quote(spec.owner)+" = ?"+spec.filter), userID); err != nil {
				return nil, err
			}
		}
	}
	idMaps := map[string]map[int64]int32{}
	uidMaps := map[string]map[string]string{}
	for _, spec := range specs {
		uidMaps[spec.name] = map[string]string{}
	}
	suffix := " (" + shortuuid.New()[:6] + ")"
	var minMoodID int64
	if err := tx.QueryRowContext(ctx, "SELECT COALESCE(MIN(memo_id), 0) FROM memo_mood_history").Scan(&minMoodID); err != nil {
		return nil, err
	}
	if minMoodID > 0 {
		minMoodID = 0
	}
	for _, spec := range specs {
		idMaps[spec.name] = map[int64]int32{}
		for _, source := range data.Tables[spec.name] {
			row := store.UserArchiveRow{}
			for key, value := range source {
				row[key] = value
			}
			if spec.name == "profile" {
				// Account identity, role, password, and active sessions are never restored.
				for _, column := range strings.Split(spec.columns, ",") {
					if policy != "REPLACE" {
						continue
					}
					if _, err := tx.ExecContext(ctx, a.bind("UPDATE "+a.quote("user")+" SET "+a.quote(column)+" = ? WHERE id = ?"), row[column], userID); err != nil {
						return nil, err
					}
				}
				if policy == "REPLACE" {
					result.Updated++
				} else {
					result.Skipped++
				}
				continue
			}
			if spec.name == "settings" {
				var count int
				if err := tx.QueryRowContext(ctx, a.bind("SELECT COUNT(*) FROM user_setting WHERE user_id = ? AND "+a.quote("key")+" = ?"), userID, row["key"]).Scan(&count); err != nil {
					return nil, err
				}
				if count > 0 && policy != "REPLACE" {
					result.Skipped++
					continue
				}
				if _, err := tx.ExecContext(ctx, a.bind("DELETE FROM user_setting WHERE user_id = ? AND "+a.quote("key")+" = ?"), userID, row["key"]); err != nil {
					return nil, err
				}
				if _, err := a.insert(ctx, tx, spec, userID, row); err != nil {
					return nil, err
				}
				if count > 0 {
					result.Updated++
				} else {
					result.Created++
				}
				continue
			}
			if skipPersonal {
				result.Skipped++
				continue
			}
			if oldUID, ok := row["uid"].(string); ok {
				fresh := shortuuid.New()
				uidMaps[spec.name][oldUID] = fresh
				row["uid"] = fresh
			}
			if policy == "DUPLICATE" && (spec.name == "wallets" || spec.name == "categories" || spec.name == "reminderLists") {
				row["name"] = row["name"].(string) + suffix
			}
			for column, table := range map[string]string{"list_id": "reminderLists", "wallet_id": "wallets", "destination_wallet_id": "wallets", "category_id": "categories"} {
				value, ok := row[column]
				if !ok || value == nil {
					continue
				}
				oldID, err := number(value)
				if err != nil {
					return nil, err
				}
				id, ok := idMaps[table][oldID]
				if !ok {
					return nil, errors.Errorf("missing %s reference", table)
				}
				row[column] = id
			}
			if value, ok := row["memo_id"]; ok && spec.name == "reminders" && value != nil {
				oldID, err := number(value)
				if err != nil {
					return nil, err
				}
				row["memo_id"] = nil
				if id, ok := memoIDs[data.MemoUIDs[strconv.FormatInt(oldID, 10)]]; ok {
					row["memo_id"] = id
				}
			}
			for _, column := range []string{"reminder_uid", "list_uid"} {
				if uid, ok := row[column].(string); ok {
					table := "reminders"
					if column == "list_uid" {
						table = "reminderLists"
					}
					if mapped, found := uidMaps[table][uid]; found {
						row[column] = mapped
					} else {
						mapped = shortuuid.New()
						uidMaps[table][uid] = mapped
						row[column] = mapped
					}
				}
			}
			if uid, ok := row["memo_uid"].(string); ok && spec.name == "occurrences" {
				if id, found := memoIDs[uid]; found {
					var mapped string
					if err := tx.QueryRowContext(ctx, a.bind("SELECT uid FROM memo WHERE id = ? AND creator_id = ?"), id, userID).Scan(&mapped); err != nil {
						return nil, err
					}
					row["memo_uid"] = mapped
				} else {
					row["memo_uid"] = ""
				}
			}
			if spec.name == "notifications" {
				sender, err := number(row["sender_id"])
				if err != nil {
					return nil, err
				}
				row["sender_id"] = 0
				if sender == int64(data.SourceUserID) {
					row["sender_id"] = userID
				} else if username, ok := data.SenderUsernames[strconv.FormatInt(sender, 10)]; ok {
					var id int32
					err := tx.QueryRowContext(ctx, a.bind("SELECT id FROM "+a.quote("user")+" WHERE username = ?"), username).Scan(&id)
					if err != nil && !errors.Is(err, sql.ErrNoRows) {
						return nil, err
					}
					row["sender_id"] = id
				}
				raw, ok := row["message"].(string)
				if !ok {
					return nil, errors.New("notification message must be JSON")
				}
				message := &storepb.InboxMessage{}
				if err := protojson.Unmarshal([]byte(raw), message); err != nil {
					return nil, err
				}
				memoID := func(old int32) int32 { return memoIDs[data.MemoUIDs[strconv.FormatInt(int64(old), 10)]] }
				if payload := message.GetMemoComment(); payload != nil {
					payload.MemoId = memoID(payload.MemoId)
					payload.RelatedMemoId = memoID(payload.RelatedMemoId)
				}
				if payload := message.GetMemoMention(); payload != nil {
					payload.MemoId = memoID(payload.MemoId)
					payload.RelatedMemoId = memoID(payload.RelatedMemoId)
				}
				if payload := message.GetReminder(); payload != nil {
					payload.ReminderId = idMaps["reminders"][int64(payload.ReminderId)]
					payload.ReminderUid = uidMaps["reminders"][payload.ReminderUid]
				}
				// Restoring a notification never grants membership in its former space.
				if payload := message.GetSpaceInvitation(); payload != nil {
					payload.SpaceId = 0
				}
				encoded, err := protojson.Marshal(message)
				if err != nil {
					return nil, err
				}
				row["message"] = string(encoded)
			}
			if spec.name == "moodHistory" {
				minMoodID--
				row["memo_id"] = minMoodID
			}
			id, err := a.insert(ctx, tx, spec, userID, row)
			if err != nil {
				return nil, errors.Wrapf(err, "restore %s", spec.name)
			}
			if old, ok := row["id"]; ok {
				oldID, _ := number(old)
				idMaps[spec.name][oldID] = id
			}
			if policy == "REPLACE" && existing > 0 {
				result.Updated++
			} else {
				result.Created++
			}
		}
	}
	return result, tx.Commit()
}
