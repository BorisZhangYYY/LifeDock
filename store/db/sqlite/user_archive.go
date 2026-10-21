package sqlite

import (
	"context"

	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/userarchive"
)

// ExportUserArchiveData reads a user-scoped personal snapshot.
func (d *DB) ExportUserArchiveData(ctx context.Context, userID int32) (*store.UserArchiveData, error) {
	return (userarchive.Adapter{DB: d.db, Dialect: "sqlite"}).Export(ctx, userID)
}

// ImportUserArchiveData restores personal data atomically with remapped identifiers.
func (d *DB) ImportUserArchiveData(ctx context.Context, userID int32, data *store.UserArchiveData, policy string, memoIDs map[string]int32) (*store.UserArchiveResult, error) {
	return (userarchive.Adapter{DB: d.db, Dialect: "sqlite"}).Import(ctx, userID, data, policy, memoIDs)
}
