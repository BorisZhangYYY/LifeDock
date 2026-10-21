package test

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/core/memoarchive"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestUserArchiveIncludesPersonalModulesAndUnlinkedFiles(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	owner, err := ts.CreateRegularUser(ctx, "archive-owner")
	require.NoError(t, err)
	target, err := ts.CreateRegularUser(ctx, "archive-target")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	_, err = ts.Service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{Content: "private record", Visibility: v1pb.Visibility_PRIVATE}})
	require.NoError(t, err)
	wallet, err := ts.Store.CreateFinanceWallet(ctx, &store.FinanceWallet{UID: "full-archive-wallet", CreatorID: owner.ID, Name: "Cash", InitialBalanceMinor: 12345})
	require.NoError(t, err)
	fileBytes := []byte("a file that was never attached to a memo")
	_, err = ts.Service.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{AttachmentId: "unlinked-archive-file", Attachment: &v1pb.Attachment{Filename: "notes.txt", Type: "text/plain", Content: fileBytes}})
	require.NoError(t, err)
	body, err := ts.Service.ExportMemos(ownerCtx, &v1pb.ExportMemosRequest{Name: "users/" + owner.Username})
	require.NoError(t, err)
	archive, err := memoarchive.Read(bytes.NewReader(body.Data), int64(len(body.Data)))
	require.NoError(t, err)
	require.True(t, archive.Manifest.UserData)
	require.Len(t, archive.UnlinkedAttachments, 1)
	actual, err := archive.ReadAttachment(&archive.UnlinkedAttachments[0])
	require.NoError(t, err)
	require.Equal(t, fileBytes, actual)
	targetCtx := ts.CreateUserContext(ctx, target.ID)
	plan, err := ts.Service.PlanMemoArchiveImport(targetCtx, target, archive)
	require.NoError(t, err)
	require.Positive(t, plan.PersonalRecords)
	require.EqualValues(t, 1, plan.Attachments)
	report, err := ts.Service.ImportMemoArchive(targetCtx, target, archive, v1pb.ImportMemosRequest_REPLACE)
	require.NoError(t, err)
	require.Zero(t, report.Failed)
	require.Zero(t, report.PersonalFailed, report.Failures)
	require.Positive(t, report.PersonalRecords)
	wallets, err := ts.Store.ListFinanceWallets(ctx, &store.FindFinanceWallet{CreatorID: &target.ID})
	require.NoError(t, err)
	require.Len(t, wallets, 1)
	require.Equal(t, wallet.BalanceMinor, wallets[0].BalanceMinor)
	files, err := ts.Store.ListAttachments(ctx, &store.FindAttachment{CreatorID: &target.ID, SkipDefaultLimit: true})
	require.NoError(t, err)
	require.Len(t, files, 1)
	require.Nil(t, files[0].MemoID)
	// Corrupt personal data is rejected before adding any memo records.
	personal, err := store.DecodeUserArchiveData(archive.UserData)
	require.NoError(t, err)
	personal.Tables["settings"] = []store.UserArchiveRow{{"key": "REFRESH_TOKENS", "value": "{}"}}
	archive.UserData, err = json.Marshal(personal)
	require.NoError(t, err)
	_, err = ts.Service.ImportMemoArchive(targetCtx, target, archive, v1pb.ImportMemosRequest_DUPLICATE)
	require.Error(t, err)
	memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &target.ID})
	require.NoError(t, err)
	require.Len(t, memos, 1)
}
