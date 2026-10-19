package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestAttachmentBrowsingFollowsReadableMemosAndCreatorScope(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	author := createSpaceTestUser(ctx, t, service, "browse-author", store.RoleUser)
	reader := createSpaceTestUser(ctx, t, service, "browse-reader", store.RoleUser)
	outsider := createSpaceTestUser(ctx, t, service, "browse-outsider", store.RoleUser)
	space, err := service.CreateSpace(userCtx(ctx, author.ID), &v1pb.CreateSpaceRequest{SpaceId: "browse-space", Space: &v1pb.Space{Title: "Browse"}})
	require.NoError(t, err)
	inviteAndAcceptSpaceTestUser(ctx, t, service, author, reader, space, v1pb.SpaceMember_USER)
	spaceUID := "browse-space"
	storedSpace, err := service.Store.GetSpace(ctx, &store.FindSpace{UID: &spaceUID})
	require.NoError(t, err)
	for _, visibility := range []store.Visibility{store.Public, store.Protected, store.Private, store.SpaceAudience} {
		memo, err := service.Store.CreateMemo(ctx, &store.Memo{UID: "browse-" + visibility.String(), CreatorID: author.ID, Content: "Browse", Visibility: visibility, SpaceID: &storedSpace.ID})
		require.NoError(t, err)
		_, err = service.Store.CreateAttachment(ctx, &store.Attachment{UID: "file-" + visibility.String(), CreatorID: author.ID, Filename: visibility.String() + ".txt", MemoID: &memo.ID})
		require.NoError(t, err)
	}
	for _, user := range []*store.User{author, reader} {
		_, err := service.Store.CreateAttachment(ctx, &store.Attachment{UID: "unused-" + user.Username, CreatorID: user.ID, Filename: "unused.txt"})
		require.NoError(t, err)
	}
	list := func(user *store.User, filter string) []string {
		t.Helper()
		response, err := service.ListAttachments(userCtx(ctx, user.ID), &v1pb.ListAttachmentsRequest{Filter: filter})
		require.NoError(t, err)
		names := make([]string, 0, len(response.Attachments))
		for _, attachment := range response.Attachments {
			names = append(names, attachment.Name)
		}
		return names
	}
	require.ElementsMatch(t, []string{"attachments/file-PUBLIC", "attachments/file-PROTECTED", "attachments/file-SPACE", "attachments/unused-browse-reader"}, list(reader, ""))
	require.ElementsMatch(t, []string{"attachments/file-PUBLIC", "attachments/file-PROTECTED", "attachments/file-SPACE"}, list(reader, `creator == "users/browse-author"`))
	require.ElementsMatch(t, []string{"attachments/file-PUBLIC", "attachments/file-PROTECTED", "attachments/file-SPACE"}, list(reader, `creator == "users/browse-author" && space == "spaces/browse-space"`))
	require.ElementsMatch(t, []string{"attachments/file-PUBLIC", "attachments/file-PROTECTED"}, list(outsider, `creator == "users/browse-author"`))
	require.Empty(t, list(outsider, `memo_id == null`), "unlinked uploads remain private")
	require.Empty(t, list(reader, `creator == "users/browse-outsider"`))
}
