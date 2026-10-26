package test

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestMemoAttachmentAndImageFilters(t *testing.T) {
	ctx := context.Background()
	st := NewTestingStore(ctx, t)
	defer st.Close()
	owner, err := createTestingHostUser(ctx, st)
	require.NoError(t, err)
	ids := map[string]int32{}
	for _, name := range []string{"plain", "inline", "photo", "document", "upper"} {
		property := &storepb.MemoPayload_Property{HasInlineImage: name == "inline"}
		memo, err := st.CreateMemo(ctx, &store.Memo{UID: name, CreatorID: owner.ID, Content: name, Visibility: store.Private, Payload: &storepb.MemoPayload{Property: property}})
		require.NoError(t, err)
		ids[name] = memo.ID
	}
	var photo *store.Attachment
	for _, item := range []struct{ name, mime string }{{"photo", "image/jpeg"}, {"document", "application/pdf"}, {"upper", "IMAGE/HEIC"}} {
		id := ids[item.name]
		attachment, err := st.CreateAttachment(ctx, &store.Attachment{UID: item.name, CreatorID: owner.ID, Filename: item.name, Type: item.mime, MemoID: &id})
		require.NoError(t, err)
		if item.name == "photo" {
			photo = attachment
		}
	}
	_, err = st.CreateAttachment(ctx, &store.Attachment{UID: "unbound", CreatorID: owner.ID, Filename: "unbound", Type: "image/png"})
	require.NoError(t, err)
	check := func(expression string, names ...string) {
		t.Helper()
		memos, err := st.ListMemos(ctx, &store.FindMemo{Filters: []string{expression}, Access: &store.MemoAccessScope{UserID: &owner.ID}})
		require.NoError(t, err)
		got := []string{}
		for _, memo := range memos {
			got = append(got, memo.UID)
		}
		slices.Sort(got)
		slices.Sort(names)
		require.Equal(t, names, got, expression)
	}
	check("has_attachments", "document", "photo", "upper")
	check("has_image", "inline", "photo", "upper")
	check("has_image == false", "document", "plain")
	check("has_attachments && !has_image", "document")
	check("has_image && !has_attachments", "inline")
	// Rebinding and deletion change the result without rewriting any memo payload.
	target := ids["plain"]
	require.NoError(t, st.UpdateAttachment(ctx, &store.UpdateAttachment{ID: photo.ID, MemoID: &target}))
	check("has_image", "inline", "plain", "upper")
	require.NoError(t, st.DeleteAttachment(ctx, &store.DeleteAttachment{ID: photo.ID}))
	check("has_image", "inline", "upper")
	// Internal rebuild pagination follows stable IDs even if an earlier row disappears.
	limit, after := 2, int32(0)
	first, err := st.ListMemos(ctx, &store.FindMemo{OrderByID: true, AfterID: &after, Limit: &limit})
	require.NoError(t, err)
	require.Len(t, first, 2)
	after = first[1].ID
	require.NoError(t, st.DeleteMemo(ctx, &store.DeleteMemo{ID: first[0].ID}))
	next, err := st.ListMemos(ctx, &store.FindMemo{OrderByID: true, AfterID: &after})
	require.NoError(t, err)
	require.Len(t, next, 3)
}
