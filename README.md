# Google Workspace MCP Server

A Model Context Protocol (MCP) server for Google Workspace integration with **send-as alias support**, email templates, and scheduled send. This server enables AI assistants to manage Gmail and Google Calendar through natural language interactions.

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
- ✅ **Send emails** with dynamic send-as alias support
- ✅ **List aliases** - auto-discover all configured send-as addresses
- ✅ **Email templates** - save and reuse templates with variables
- ✅ **Scheduled send** - schedule emails for later delivery
- ✅ **Draft emails** - create drafts without sending
- ✅ **Search emails** - using Gmail search syntax
- ✅ **Read emails** - get full email content
- ✅ **Label management** - create, update, delete labels
- ✅ **Batch operations** - process multiple emails efficiently
- ✅ **Attachment support** - send and receive attachments

### Google Calendar
- ✅ **Create events** - with attendees, reminders, and location
- ✅ **List events** - view upcoming events
- ✅ **Update events** - modify existing events
- ✅ **Delete events** - remove events
- ✅ **Search events** - find events by query
- ✅ **Free/Busy check** - check availability across calendars
- ✅ **Multi-calendar support** - work with multiple calendars
- ✅ **Recurring events** - support for repeating events

## 📦 Installation

### Using npm (Recommended)

```bash
npm install -g google-workspace-mcp
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
npx google-workspace-mcp auth
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
      "args": ["google-workspace-mcp"]
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
      "args": ["google-workspace-mcp"]
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
