package filter

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRenderExistsComparisonsPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	predicates := map[string]map[DialectName]string{
		"has_attachments": {
			DialectSQLite:   "EXISTS (SELECT 1 FROM `attachment` WHERE `attachment`.`memo_id` = `memo`.`id`)",
			DialectMySQL:    "EXISTS (SELECT 1 FROM `attachment` WHERE `attachment`.`memo_id` = `memo`.`id`)",
			DialectPostgres: "EXISTS (SELECT 1 FROM attachment WHERE attachment.memo_id = memo.id)",
		},
		"has_image": {
			DialectSQLite: "(JSON_EXTRACT(`memo`.`payload`, '$.property.hasInlineImage') IS TRUE OR " +
				"EXISTS (SELECT 1 FROM `attachment` WHERE `attachment`.`memo_id` = `memo`.`id` AND LOWER(`attachment`.`type`) LIKE 'image/%'))",
			DialectMySQL: "(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.property.hasInlineImage'), CAST('false' AS JSON)) = CAST('true' AS JSON) OR " +
				"EXISTS (SELECT 1 FROM `attachment` WHERE `attachment`.`memo_id` = `memo`.`id` AND LOWER(`attachment`.`type`) LIKE 'image/%'))",
			DialectPostgres: "((memo.payload->'property'->>'hasInlineImage')::boolean IS TRUE OR " +
				"EXISTS (SELECT 1 FROM attachment WHERE attachment.memo_id = memo.id AND LOWER(attachment.type) LIKE 'image/%'))",
		},
	}
	for field, byDialect := range predicates {
		for dialect, predicate := range byDialect {
			cases := []struct {
				expr string
				sql  string
			}{
				{field, predicate},
				{"!" + field, "NOT (" + predicate + ")"},
				{field + " == true", predicate},
				{field + " == false", "NOT (" + predicate + ")"},
				{field + " != true", "NOT (" + predicate + ")"},
				{field + " != false", predicate},
			}
			for _, tc := range cases {
				stmt, err := engine.CompileToStatement(context.Background(), tc.expr, RenderOptions{Dialect: dialect})
				require.NoError(t, err, dialect, tc.expr)
				require.Equal(t, tc.sql, stmt.SQL, dialect, tc.expr)
				require.Empty(t, stmt.Args, dialect, tc.expr)
			}
		}
	}
}

func TestRenderExistsRejectsUnsupportedOperators(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	for _, expr := range []string{`has_image > false`, `has_attachments == "yes"`, `"image" in has_image`} {
		_, err := engine.CompileToStatement(context.Background(), expr, RenderOptions{Dialect: DialectSQLite})
		require.Error(t, err, expr)
	}
}

// TestExistsSQLiteBehavior pins has_attachments and has_image against real
// tables: has_attachments follows attachment.memo_id alone, and has_image is
// true for Markdown image syntax or an attached image/* file, whatever the
// MIME type's case, and false for other attachments and unbound uploads.
func TestExistsSQLiteBehavior(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`CREATE TABLE memo (id INTEGER PRIMARY KEY, payload TEXT)`)
	require.NoError(t, err)
	_, err = db.Exec(`CREATE TABLE attachment (id INTEGER PRIMARY KEY, memo_id INTEGER, type TEXT NOT NULL DEFAULT '')`)
	require.NoError(t, err)

	for _, fixture := range []struct {
		id      int
		payload any
	}{
		{1, `{}`}, // nothing
		{2, `{"property":{"hasInlineImage":true}}`}, // external image in content, no attachment
		{3, `{}`}, // uploaded photo, not referenced in content
		{4, `{}`}, // PDF attachment only
		{5, `{"property":{"hasInlineImage":true}}`}, // managed inline image, also bound
		{6, nil}, // NULL payload, upper-case MIME image
		{7, `{"property":{"hasInlineImage":false}}`}, // explicit false flag, nothing attached
	} {
		_, err = db.Exec(`INSERT INTO memo (id, payload) VALUES (?, ?)`, fixture.id, fixture.payload)
		require.NoError(t, err)
	}
	for _, attachment := range []struct {
		memoID   any
		mimeType string
	}{
		{3, "image/jpeg"},
		{4, "application/pdf"},
		{5, "image/png"},
		{6, "IMAGE/HEIC"},
		{nil, "image/png"}, // uploaded but not bound to any memo
	} {
		_, err = db.Exec(`INSERT INTO attachment (memo_id, type) VALUES (?, ?)`, attachment.memoID, attachment.mimeType)
		require.NoError(t, err)
	}

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		expr string
		want []int
	}{
		{`has_attachments`, []int{3, 4, 5, 6}},
		{`!has_attachments`, []int{1, 2, 7}},
		{`has_attachments == false`, []int{1, 2, 7}},
		{`has_image`, []int{2, 3, 5, 6}},
		{`!has_image`, []int{1, 4, 7}},
		{`has_image != true`, []int{1, 4, 7}},
		{`has_attachments && !has_image`, []int{4}},
		{`has_image && !has_attachments`, []int{2}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), tc.expr, RenderOptions{Dialect: DialectSQLite})
		require.NoError(t, err, tc.expr)
		require.Equal(t, tc.want, selectMemoIDs(t, db, stmt), tc.expr)
	}
}
