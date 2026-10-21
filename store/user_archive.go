package store

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/pkg/errors"
)

// UserArchiveRow holds scalar columns from a versioned, allowlisted user-data table.
type UserArchiveRow map[string]any

// UserArchiveData complements memo records with personal data and user preferences.
// Database identifiers are remapped on import and never used as authorization inputs.
type UserArchiveData struct {
	SourceUserID    int32                       `json:"sourceUserID"`
	SenderUsernames map[string]string           `json:"senderUsernames,omitempty"`
	Version         int                         `json:"version"`
	Tables          map[string][]UserArchiveRow `json:"tables"`
	MemoUIDs        map[string]string           `json:"memoUIDs"`
}

// Count returns the number of non-memo records in the snapshot.
func (d *UserArchiveData) Count() int32 {
	var count int32
	for _, rows := range d.Tables {
		count += int32(len(rows))
	}
	return count
}

// UserArchiveResult reports the personal records restored or retained by an import.
type UserArchiveResult struct{ Created, Updated, Skipped int32 }

// ExportUserArchiveData reads only the specified user's personal data.
func (s *Store) ExportUserArchiveData(ctx context.Context, userID int32) (*UserArchiveData, error) {
	return s.driver.ExportUserArchiveData(ctx, userID)
}

// ImportUserArchiveData restores a snapshot with remapped references, then clears affected caches.
func (s *Store) ImportUserArchiveData(ctx context.Context, userID int32, data *UserArchiveData, policy string, memoIDs map[string]int32) (*UserArchiveResult, error) {
	result, err := s.driver.ImportUserArchiveData(ctx, userID, data, policy, memoIDs)
	if err != nil {
		return nil, err
	}
	s.userCache.Delete(ctx, userCacheKey(userID))
	for _, row := range data.Tables["settings"] {
		if key, ok := row["key"].(string); ok {
			s.userSettingCache.Delete(ctx, getUserSettingCacheKey(userID, key))
		}
	}
	return result, nil
}

// DecodeUserArchiveData keeps exact integer values, including monetary amounts.
func DecodeUserArchiveData(raw json.RawMessage) (*UserArchiveData, error) {
	var data UserArchiveData
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&data); err != nil {
		return nil, errors.Wrap(err, "invalid user data")
	}
	return &data, nil
}
