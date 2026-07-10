# GWS MCP - Google Workspace MCP Server

A Model Context Protocol (MCP) server for Google Workspace integration with **send-as alias support**, email templates, and scheduled send. This server enables AI assistants to manage Gmail and Google Calendar through natural language interactions.

### Why `gws-mcp`?
- **Unique**: Only MCP with send-as alias support
- **Unified**: Gmail + Calendar in one package
- **Full Featured**: 28 tools with complete API coverage

## ✨ Why This MCP?

| Feature | This MCP | Gmail MCP (Original) |
|---------|----------|---------------------|
| **Send-As Alias Support** | ✅ Dynamic discovery | ❌ Not supported |
| **Email Templates** | ✅ With variables | ❌ Not supported |
| **Scheduled Send** | ✅ Built-in | ❌ Not supported |
| **Gmail + Calendar** | ✅ Unified | ❌ Gmail only |
| **Multi-Account** | ✅ Planned | ❌ Not supported |
| **Free/Busy Check** | ✅ Built-in | ❌ Not supported |

## 🚀 Features

### Gmail
- ✅ **Send emails** - with subject, content, attachments, and recipients
- ✅ **Send-As Alias Support** - dynamic discovery of all configured aliases
- ✅ **Email templates** - save and reuse templates with variables
- ✅ **Scheduled send** - schedule emails for later delivery
- ✅ **Draft emails** - create drafts without sending
- ✅ **Read emails** - get full email content with enhanced attachment display
- ✅ **List emails** - view inbox, sent, or custom labels
- ✅ **Search emails** - using Gmail search syntax
- ✅ **Modify emails** - mark read/unread, move to labels/folders
- ✅ **Delete emails** - permanent deletion
- ✅ **Download attachments** - save attachments to local filesystem
- ✅ **Label management** - create, update, delete labels
- ✅ **Batch operations** - process multiple emails efficiently
- ✅ **Full attachment support** - send and receive file attachments
- ✅ **HTML emails** - multipart messages with both HTML and plain text
- ✅ **International characters** - full support in subject and content

### Google Calendar
- ✅ **Create events** - with title, time, description, location, attendees
- ✅ **Get event** - retrieve event details by ID
- ✅ **List events** - view events within specified time range
- ✅ **Update events** - modify existing events
- ✅ **Delete events** - remove events
- ✅ **Search events** - find events by query
- ✅ **Free/Busy check** - check availability across calendars
- ✅ **Multi-calendar support** - work with multiple calendars
- ✅ **Recurring events** - support for repeating events

## 📦 Installation

### Using npm (Recommended)

```bash
npm install -g gws-mcp
```

### Manual Installation

```bash
git clone https://github.com/johndelapena168/google-workspace-mcp.git
cd google-workspace-mcp
npm install
```

## ⚙️ Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Desktop app" as application type
4. Give it a name (e.g., "Google Workspace MCP")
5. Click "Create"
6. Download the JSON file
7. Rename it to `gcp-oauth.keys.json`

### 3. Authenticate

Place your `gcp-oauth.keys.json` in one of these locations:
- `~/.google-workspace-mcp/` (recommended)
- Current directory

Then run:

```bash
npx gws-mcp auth
```

This will:
1. Open your browser for Google authentication
2. Ask for permission to access Gmail and Calendar
3. Save credentials locally for future use

## 🔧 Configuration

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["gws-mcp"]
    }
  }
}
```

### Cursor

Add to your Cursor settings:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["gws-mcp"]
    }
  }
}
```

### Qoder

The MCP will be automatically detected when installed globally.

## 📖 Usage Examples

### Send Email with Alias

```json
{
  "tool": "send_email",
  "arguments": {
    "to": ["client@example.com"],
    "subject": "Project Update",
    "body": "Hi,\n\nHere's the latest update on the project.\n\nBest regards",
    "from": "hello@nexteraofai.com"
  }
}
```

### List Available Aliases

```json
{
  "tool": "list_aliases",
  "arguments": {}
}
```

### List Email Templates

```json
{
  "tool": "list_templates",
  "arguments": {}
}
```

### Send Email Using Template

```json
{
  "tool": "send_template_email",
  "arguments": {
    "template": "meeting-followup",
    "to": ["client@example.com"],
    "variables": {
      "name": "John",
      "meeting_name": "Project Review",
      "summary": "Discussed project timeline and milestones",
      "next_steps": "1. Finalize requirements\n2. Start development",
      "sender_name": "John Dela Pena"
    },
    "from": "hello@nexteraofai.com"
  }
}
```

### Create Custom Template

```json
{
  "tool": "create_template",
  "arguments": {
    "name": "weekly-report",
    "displayName": "Weekly Report",
    "subject": "Weekly Report: {{week_date}}",
    "body": "Hi {{name}},\n\nHere's the weekly report for {{week_date}}:\n\n{{report_content}}\n\nBest regards,\n{{sender_name}}"
  }
}
```

### Schedule Email for Later

```json
{
  "tool": "send_scheduled_email",
  "arguments": {
    "to": ["team@example.com"],
    "subject": "Weekly Update",
    "body": "Here's the weekly project update...",
    "scheduledTime": "2026-07-15T09:00:00",
    "from": "hello@nexteraofai.com"
  }
}
```

### Create Calendar Event

```json
{
  "tool": "create_event",
  "arguments": {
    "summary": "Project Kickoff Meeting",
    "description": "Initial meeting to discuss project scope and timeline",
    "location": "Zoom Meeting",
    "start": "2026-07-15T14:00:00",
    "end": "2026-07-15T15:00:00",
    "attendees": ["john@example.com", "jane@example.com"],
    "reminders": [
      { "method": "email", "minutes": 60 },
      { "method": "popup", "minutes": 10 }
    ]
  }
}
```

### Search Events

```json
{
  "tool": "search_events",
  "arguments": {
    "query": "meeting",
    "timeMin": "2026-07-01T00:00:00Z",
    "timeMax": "2026-07-31T23:59:59Z",
    "maxResults": 20
  }
}
```

### Check Free/Busy

```json
{
  "tool": "get_freebusy",
  "arguments": {
    "timeMin": "2026-07-15T09:00:00Z",
    "timeMax": "2026-07-15T17:00:00Z",
    "calendars": ["primary", "work@example.com"]
  }
}
```

### Get Event by ID

```json
{
  "tool": "get_event",
  "arguments": {
    "calendarId": "primary",
    "eventId": "abc123def456"
  }
}
```

### List Emails in Inbox

```json
{
  "tool": "list_emails",
  "arguments": {
    "labelIds": ["INBOX"],
    "maxResults": 10
  }
}
```

### Mark Email as Read

```json
{
  "tool": "modify_email",
  "arguments": {
    "messageId": "18a1b2c3d4e5f6789",
    "removeLabelIds": ["UNREAD"]
  }
}
```

### Move Email to Label

```json
{
  "tool": "modify_email",
  "arguments": {
    "messageId": "18a1b2c3d4e5f6789",
    "addLabelIds": ["Label_123"],
    "removeLabelIds": ["INBOX"]
  }
}
```

### Download Attachment

```json
{
  "tool": "download_attachment",
  "arguments": {
    "messageId": "18a1b2c3d4e5f6789",
    "attachmentId": "ANGjdJ8z7_OQ",
    "savePath": "C:/Users/Downloads"
  }
}
```

### Create New Label

```json
{
  "tool": "create_label",
  "arguments": {
    "name": "Client Projects",
    "messageListVisibility": "show",
    "labelListVisibility": "labelShow"
  }
}
```

### Batch Delete Emails

```json
{
  "tool": "batch_delete_emails",
  "arguments": {
    "messageIds": ["msg1", "msg2", "msg3"]
  }
}
```

## 🎯 Unique Selling Points

### 1. Dynamic Alias Support
No other MCP server supports Gmail send-as aliases. This MCP automatically discovers all configured aliases and lets you send from any of them.

### 2. Email Templates
Save frequently used email templates with variables:
```
"Use meeting-followup template for {{name}}"
```

### 3. Scheduled Send
Schedule emails for later delivery:
```json
{
  "scheduledTime": "2026-07-15T09:00:00"
}
```

### 4. Unified Workspace
Gmail + Calendar in one MCP server. No need to install separate servers.

## 🔐 Security

- OAuth credentials are stored locally in `~/.google-workspace-mcp/`
- Tokens are automatically refreshed when expired
- No data is sent to third-party servers
- Full control over permissions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
git clone https://github.com/johndelapena168/google-workspace-mcp.git
cd google-workspace-mcp
npm install
npm start
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Inspired by [Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server) by GongRzhe
- Built with [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Uses [Google APIs](https://github.com/googleapis/google-api-nodejs-client)

## 📧 Contact

- GitHub: [@johndelapena168](https://github.com/johndelapena168)
- Email: hello@nexteraofai.com

## ⭐ Support

If you find this MCP useful, please give it a star on GitHub!
