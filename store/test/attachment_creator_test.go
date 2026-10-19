package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestAttachmentCreatorFilterUsesMemoAuthorAndUnlinkedUploader(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	author, err := ts.CreateUser(ctx, &store.User{Username: "author", Role: store.RoleUser})
	require.NoError(t, err)
	uploader, err := ts.CreateUser(ctx, &store.User{Username: "uploader", Role: store.RoleUser})
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "author-memo", CreatorID: author.ID, Content: "Memo", Visibility: store.Public})
	require.NoError(t, err)
	linked, err := ts.CreateAttachment(ctx, &store.Attachment{UID: "author-linked", CreatorID: uploader.ID, Filename: "linked.txt", MemoID: &memo.ID})
	require.NoError(t, err)
	unused, err := ts.CreateAttachment(ctx, &store.Attachment{UID: "uploader-unused", CreatorID: uploader.ID, Filename: "unused.txt"})
	require.NoError(t, err)
	for _, test := range []struct {
		username string
		id       int32
	}{{"author", linked.ID}, {"uploader", unused.ID}} {
		attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{Filters: []string{`creator == "users/` + test.username + `"`}, Access: &store.MemoAccessScope{UserID: &uploader.ID, AllowPublic: true}})
		require.NoError(t, err)
		require.Len(t, attachments, 1)
		require.Equal(t, test.id, attachments[0].ID)
	}
}
