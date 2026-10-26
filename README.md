# LIfeDock

**Bring your notes, moods, finances, and reminders into one personal space.**

LIfeDock is an open-source, self-hosted personal life management app built on [Memos](https://github.com/usememos/memos).
It keeps Memos' lightweight, Markdown-native approach to quick capture, while bringing mood tracking, personal finance, and reminders into your daily workflow.

Capture an idea, reflect on how you feel, track everyday spending, or turn a plan in your notes into a reminder. Your data lives on your own server, under your control.

[Deployment guide](docs/fork-deploy.md) · [Releases](https://github.com/BorisZhangYYY/memos/releases) · [Report an issue](https://github.com/BorisZhangYYY/memos/issues)

English · [简体中文](docs/README.zh-CN.md)

![LIfeDock timeline with notes, mood tracking and linked reminders in English](docs/images/lifedock-timeline.png)

## Features

### Capture the moment, build a history

- **Timeline notes**: Open and write. Keep your thoughts, discoveries, and everyday moments together in a timeline.
- **Markdown editing**: Switch between rich text and Markdown source, with tags, attachments, images, and voice recordings to organize your notes.
- **Search and filters**: Find past entries by tags, mood, attachments, or images.

### Make space for how you feel

- **Mood tracking**: Add a mood to a note, then explore your history and statistics on a dedicated mood page.
- **Calendar insights**: See daily and monthly mood indicators to reflect on how you have been feeling over time.
- **Personal touches**: Customize the emoji and color for each mood level.

![LIfeDock mood history and statistics in English](docs/images/lifedock-mood.png)

Review mood entries by date, with your average mood, days recorded, and total entries over the last 30 days. Select a mood entry to return to its linked note.

### Keep everyday finances in view

- **Wallets and categories**: Manage multiple wallets and income or expense categories. Record income, spending, transfers, and balance adjustments.
- **Spending insights**: Review today's activity, transaction history, and summaries to understand where your money goes.

![LIfeDock personal finance records in English](docs/images/lifedock-finances.png)

See your total balance, daily income, expenses, and net amount in one place. The example shows everyday purchases, freelance income, and a transfer from an everyday wallet to savings.

### Give your plans a reminder

- **Reminder lists**: Organize reminders with lists, dates and times, advance notices, recurrence, priorities, and flags.
- **Linked notes**: Connect reminders to related notes so the context stays with the plan.
- **Notifications and history**: Receive in-app notifications and optional SMTP email reminders, with completion history and statistics for review.

![LIfeDock grouped reminders and linked memos in English](docs/images/lifedock-reminders.png)

Group reminders around daily habits, personal projects, and life admin. Dates, recurrence, priorities, flags, and linked notes help keep each plan in context.

### Host it yourself, connect it your way

- **Own your data**: Run LIfeDock on your own server, with user data export and import.
- **Flexible deployment**: Run a single Go binary or Docker container with SQLite, MySQL, or PostgreSQL.
- **Visibility controls**: Disable public access and configure additional interface access checks for personal dashboards and tagged notes.
- **Open integrations**: Use the REST and gRPC APIs, or connect an AI agent through the built-in MCP service to help record, query, and manage your personal information.

Access checks for personal dashboards and tagged notes protect what is displayed in the interface. They do not change note sharing permissions or encrypt your data. See [personal content privacy](docs/fork-deploy.md#个人内容隐私) for details.

## Quick start

### Docker (recommended)

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  ghcr.io/boriszhangyyy/memos:stable
```

Open <http://localhost:5230> and create your first account to get started. The first account becomes the administrator and can disable public registration in settings.

`~/.memos` stores persistent application data. The project retains the `memos` image repository name and container data path. LIfeDock images are published to `ghcr.io/boriszhangyyy/memos`.

### Binaries and building from source

Download a binary for your platform from [GitHub Releases](https://github.com/BorisZhangYYY/memos/releases), or build from this repository's source.

For complete installation steps, upgrades, data directory details, and MCP client configuration, see the [deployment guide](docs/fork-deploy.md).

## Backup and migration

Go to **Settings → Export & Import** to back up your account's notes, comments, attachments, profile, and settings, along with mood, finance, reminder, and notification records.

Preview record counts before importing, then choose to keep existing data, replace it, or create copies. Account passwords, login tokens, and other authentication credentials are excluded from migration. See [user data export and import](docs/fork-deploy.md#用户数据导出与导入) for the full scope.

## Feedback and contributions

Bug reports and feature ideas are welcome in this repository's [Issues](https://github.com/BorisZhangYYY/memos/issues). You can also improve the code, documentation, or translations through a [pull request](https://github.com/BorisZhangYYY/memos/pulls).

## Acknowledgments and license

LIfeDock is built on the open-source project [Memos](https://github.com/usememos/memos). Thank you to the Memos team and community contributors for the foundation.
Visit the [Memos website](https://usememos.com) and [official documentation](https://usememos.com/docs) to learn about the upstream project. For LIfeDock deployment and additional features, refer to this repository's documentation.

This project is licensed under the [MIT License](LICENSE) and retains the upstream copyright notice.
