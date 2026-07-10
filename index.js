#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import open from "open";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config directory
const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".google-workspace-mcp");
const OAUTH_KEYS_FILE = path.join(CONFIG_DIR, "gcp-oauth.keys.json");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");
const TEMPLATES_FILE = path.join(CONFIG_DIR, "templates.json");

// Scopes for Gmail + Calendar
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Load or initialize templates
function loadTemplates() {
  if (fs.existsSync(TEMPLATES_FILE)) {
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, "utf8"));
  }
  // Copy default templates from package
  const defaultTemplates = path.join(__dirname, "templates.json");
  if (fs.existsSync(defaultTemplates)) {
    const templates = JSON.parse(fs.readFileSync(defaultTemplates, "utf8"));
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
    return templates;
  }
  return {};
}

function saveTemplates(templates) {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

function applyTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

class GoogleWorkspaceMCP {
  constructor() {
    this.server = new Server(
      {
        name: "google-workspace-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.gmail = null;
    this.calendar = null;
    this.oauth2Client = null;

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleToolCall(request)
    );
  }

  getTools() {
    return [
      // Auth tool
      {
        name: "authenticate",
        description: "Authenticate with Google Workspace (opens browser for OAuth consent). Run this first before using other tools.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      // Alias tools
      {
        name: "list_aliases",
        description: "List all available send-as email aliases for the authenticated Gmail account",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      // Gmail tools
      {
        name: "send_email",
        description: "Send an email with optional alias support",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "array",
              items: { type: "string", format: "email" },
              minItems: 1,
              description: "List of recipient email addresses",
            },
            subject: {
              type: "string",
              minLength: 1,
              description: "Email subject",
            },
            body: {
              type: "string",
              description: "Email body content (plain text or HTML)",
            },
            htmlBody: {
              type: "string",
              description: "HTML version of the email body",
            },
            from: {
              type: "string",
              description: "Send-as alias email address (use list_aliases to see available aliases)",
            },
            cc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of CC recipients",
            },
            bcc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of BCC recipients",
            },
            attachments: {
              type: "array",
              items: { type: "string" },
              description: "List of file paths to attach",
            },
            mimeType: {
              type: "string",
              enum: ["text/plain", "text/html", "multipart/alternative"],
              default: "text/plain",
              description: "Email content type",
            },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "draft_email",
        description: "Create a draft email",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of recipient email addresses",
            },
            subject: {
              type: "string",
              description: "Email subject",
            },
            body: {
              type: "string",
              description: "Email body content",
            },
            htmlBody: {
              type: "string",
              description: "HTML version of the email body",
            },
            from: {
              type: "string",
              description: "Send-as alias email address",
            },
            cc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of CC recipients",
            },
            bcc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of BCC recipients",
            },
            attachments: {
              type: "array",
              items: { type: "string" },
              description: "List of file paths to attach",
            },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "read_email",
        description: "Read an email by message ID",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "The message ID to read",
            },
          },
          required: ["messageId"],
        },
      },
      {
        name: "search_emails",
        description: "Search emails using Gmail search syntax",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Gmail search query (e.g., 'from:user@example.com after:2024/01/01')",
            },
            maxResults: {
              type: "number",
              default: 10,
              description: "Maximum number of results",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_email_labels",
        description: "List all Gmail labels",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      // Calendar tools
      {
        name: "list_calendars",
        description: "List all calendars",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_events",
        description: "List events from a calendar",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              default: "primary",
              description: "Calendar ID (default: primary)",
            },
            timeMin: {
              type: "string",
              description: "Start time (ISO format)",
            },
            timeMax: {
              type: "string",
              description: "End time (ISO format)",
            },
            maxResults: {
              type: "number",
              default: 10,
              description: "Maximum number of events",
            },
          },
        },
      },
      {
        name: "create_event",
        description: "Create a calendar event",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              default: "primary",
              description: "Calendar ID",
            },
            summary: {
              type: "string",
              description: "Event title",
            },
            description: {
              type: "string",
              description: "Event description",
            },
            location: {
              type: "string",
              description: "Event location",
            },
            start: {
              type: "string",
              description: "Start time (ISO format)",
            },
            end: {
              type: "string",
              description: "End time (ISO format)",
            },
            attendees: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of attendee emails",
            },
            reminders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string", enum: ["email", "popup"] },
                  minutes: { type: "number" },
                },
              },
              description: "Event reminders",
            },
          },
          required: ["summary", "start", "end"],
        },
      },
      {
        name: "update_event",
        description: "Update an existing calendar event",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              default: "primary",
              description: "Calendar ID",
            },
            eventId: {
              type: "string",
              description: "Event ID to update",
            },
            summary: {
              type: "string",
              description: "Event title",
            },
            description: {
              type: "string",
              description: "Event description",
            },
            location: {
              type: "string",
              description: "Event location",
            },
            start: {
              type: "string",
              description: "Start time (ISO format)",
            },
            end: {
              type: "string",
              description: "End time (ISO format)",
            },
            attendees: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of attendee emails",
            },
          },
          required: ["eventId"],
        },
      },
      {
        name: "delete_event",
        description: "Delete a calendar event",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              default: "primary",
              description: "Calendar ID",
            },
            eventId: {
              type: "string",
              description: "Event ID to delete",
            },
          },
          required: ["eventId"],
        },
      },
      {
        name: "search_events",
        description: "Search calendar events",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
              type: "string",
              default: "primary",
              description: "Calendar ID",
            },
            query: {
              type: "string",
              description: "Search query",
            },
            timeMin: {
              type: "string",
              description: "Start time (ISO format)",
            },
            timeMax: {
              type: "string",
              description: "End time (ISO format)",
            },
            maxResults: {
              type: "number",
              default: 10,
              description: "Maximum number of results",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_freebusy",
        description: "Check free/busy status for calendars",
        inputSchema: {
          type: "object",
          properties: {
            timeMin: {
              type: "string",
              description: "Start time (ISO format)",
            },
            timeMax: {
              type: "string",
              description: "End time (ISO format)",
            },
            calendars: {
              type: "array",
              items: { type: "string" },
              description: "List of calendar IDs to check",
            },
          },
          required: ["timeMin", "timeMax"],
        },
      },
      // Template tools
      {
        name: "list_templates",
        description: "List all available email templates",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_template",
        description: "Get a specific template by name",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Template name",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "create_template",
        description: "Create a new email template with variables (use {{variable}} syntax)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Template name (used as ID)",
            },
            displayName: {
              type: "string",
              description: "Human-readable template name",
            },
            subject: {
              type: "string",
              description: "Email subject template (use {{variable}} for variables)",
            },
            body: {
              type: "string",
              description: "Email body template (use {{variable}} for variables)",
            },
          },
          required: ["name", "displayName", "subject", "body"],
        },
      },
      {
        name: "send_template_email",
        description: "Send an email using a template with variables",
        inputSchema: {
          type: "object",
          properties: {
            template: {
              type: "string",
              description: "Template name to use",
            },
            to: {
              type: "array",
              items: { type: "string", format: "email" },
              minItems: 1,
              description: "List of recipient email addresses",
            },
            variables: {
              type: "object",
              description: "Variables to replace in template (e.g., {\"name\": \"John\", \"meeting_name\": \"Project Review\"})",
            },
            from: {
              type: "string",
              description: "Send-as alias email address",
            },
            cc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of CC recipients",
            },
            bcc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of BCC recipients",
            },
          },
          required: ["template", "to", "variables"],
        },
      },
      // Scheduled send tools
      {
        name: "send_scheduled_email",
        description: "Schedule an email to be sent at a specific time",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "array",
              items: { type: "string", format: "email" },
              minItems: 1,
              description: "List of recipient email addresses",
            },
            subject: {
              type: "string",
              minLength: 1,
              description: "Email subject",
            },
            body: {
              type: "string",
              description: "Email body content",
            },
            htmlBody: {
              type: "string",
              description: "HTML version of the email body",
            },
            from: {
              type: "string",
              description: "Send-as alias email address",
            },
            scheduledTime: {
              type: "string",
              description: "Scheduled send time (ISO format, e.g., '2026-07-15T09:00:00')",
            },
            timezone: {
              type: "string",
              description: "Timezone for scheduled time (e.g., 'America/New_York')",
            },
            cc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of CC recipients",
            },
            bcc: {
              type: "array",
              items: { type: "string", format: "email" },
              description: "List of BCC recipients",
            },
          },
          required: ["to", "subject", "body", "scheduledTime"],
        },
      },
    ];
  }

  async authenticate() {
    // Check for OAuth keys
    if (!fs.existsSync(OAUTH_KEYS_FILE)) {
      // Check if file is in current directory
      const localKeys = path.join(process.cwd(), "gcp-oauth.keys.json");
      if (fs.existsSync(localKeys)) {
        fs.copyFileSync(localKeys, OAUTH_KEYS_FILE);
      } else {
        throw new Error(
          `OAuth keys not found. Please place gcp-oauth.keys.json in:\n` +
          `1. ${CONFIG_DIR}/ (recommended)\n` +
          `2. Current directory\n\n` +
          `To get OAuth keys:\n` +
          `1. Go to Google Cloud Console\n` +
          `2. Create OAuth 2.0 credentials (Desktop app)\n` +
          `3. Download JSON and rename to gcp-oauth.keys.json`
        );
      }
    }

    const keys = JSON.parse(fs.readFileSync(OAUTH_KEYS_FILE, "utf8"));
    const { client_id, client_secret, redirect_uris } = keys.installed || keys.web;

    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0] || "http://localhost:3000/oauth2callback"
    );

    // Check for existing credentials
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
      this.oauth2Client.setCredentials(credentials);

      // Check if token is expired and refresh if needed
      if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
        try {
          const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(newCredentials);
          fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(newCredentials, null, 2));
        } catch (error) {
          // Token refresh failed, need to re-authenticate
          return this.doOAuthFlow();
        }
      }
    } else {
      return this.doOAuthFlow();
    }

    this.initializeServices();
    return { success: true, message: "Authenticated successfully" };
  }

  async doOAuthFlow() {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    // Start local server to handle callback
    const server = http.createServer();
    const port = 3000;

    return new Promise((resolve, reject) => {
      server.on("request", async (req, res) => {
        const url = new URL(req.url, `http://localhost:${port}`);

        if (url.pathname === "/oauth2callback") {
          const code = url.searchParams.get("code");

          if (code) {
            try {
              const { tokens } = await this.oauth2Client.getToken(code);
              this.oauth2Client.setCredentials(tokens);
              fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(tokens, null, 2));

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #4CAF50;">✓ Authentication Successful!</h1>
                    <p>You can close this window and return to your AI assistant.</p>
                  </body>
                </html>
              `);

              server.close();
              this.initializeServices();
              resolve({ success: true, message: "Authenticated successfully" });
            } catch (error) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`<h1>Authentication Failed</h1><p>${error.message}</p>`);
              server.close();
              reject(error);
            }
          }
        }
      });

      server.listen(port, () => {
        // Open browser for auth
        open(authUrl);
      });
    });
  }

  initializeServices() {
    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    this.calendar = google.calendar({ version: "v3", auth: this.oauth2Client });
  }

  async handleToolCall(request) {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "authenticate":
          return this.formatResult(await this.authenticate());

        case "list_aliases":
          return this.formatResult(await this.listAliases());

        case "send_email":
          return this.formatResult(await this.sendEmail(args));

        case "draft_email":
          return this.formatResult(await this.draftEmail(args));

        case "read_email":
          return this.formatResult(await this.readEmail(args.messageId));

        case "search_emails":
          return this.formatResult(await this.searchEmails(args));

        case "list_email_labels":
          return this.formatResult(await this.listEmailLabels());

        case "list_calendars":
          return this.formatResult(await this.listCalendars());

        case "list_events":
          return this.formatResult(await this.listEvents(args));

        case "create_event":
          return this.formatResult(await this.createEvent(args));

        case "update_event":
          return this.formatResult(await this.updateEvent(args));

        case "delete_event":
          return this.formatResult(await this.deleteEvent(args));

        case "search_events":
          return this.formatResult(await this.searchEvents(args));

        case "get_freebusy":
          return this.formatResult(await this.getFreeBusy(args));

        case "list_templates":
          return this.formatResult(await this.listTemplates());

        case "get_template":
          return this.formatResult(await this.getTemplate(args.name));

        case "create_template":
          return this.formatResult(await this.createTemplate(args));

        case "send_template_email":
          return this.formatResult(await this.sendTemplateEmail(args));

        case "send_scheduled_email":
          return this.formatResult(await this.sendScheduledEmail(args));

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }

  formatResult(data) {
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  ensureAuthenticated() {
    if (!this.gmail || !this.calendar) {
      throw new Error("Not authenticated. Please run the 'authenticate' tool first.");
    }
  }

  // ============ GMAIL METHODS ============

  async listAliases() {
    this.ensureAuthenticated();
    const response = await this.gmail.users.settings.sendAs.list({
      userId: "me",
    });
    return response.data.sendAs || [];
  }

  async sendEmail(args) {
    this.ensureAuthenticated();

    const { to, subject, body, htmlBody, from, cc, bcc, attachments, mimeType } = args;

    // Build email headers
    let emailParts = [];
    emailParts.push(`To: ${to.join(", ")}`);
    emailParts.push(`Subject: ${subject}`);

    if (from) {
      emailParts.push(`From: ${from}`);
    }
    if (cc) {
      emailParts.push(`Cc: ${cc.join(", ")}`);
    }
    if (bcc) {
      emailParts.push(`Bcc: ${bcc.join(", ")}`);
    }

    // Build body
    if (mimeType === "multipart/alternative" && htmlBody) {
      const boundary = "boundary_" + Date.now();
      emailParts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      emailParts.push("");
      emailParts.push(`--${boundary}`);
      emailParts.push("Content-Type: text/plain; charset=UTF-8");
      emailParts.push("");
      emailParts.push(body);
      emailParts.push(`--${boundary}`);
      emailParts.push("Content-Type: text/html; charset=UTF-8");
      emailParts.push("");
      emailParts.push(htmlBody);
      emailParts.push(`--${boundary}--`);
    } else if (mimeType === "text/html" || htmlBody) {
      emailParts.push("Content-Type: text/html; charset=UTF-8");
      emailParts.push("");
      emailParts.push(htmlBody || body);
    } else {
      emailParts.push("Content-Type: text/plain; charset=UTF-8");
      emailParts.push("");
      emailParts.push(body);
    }

    const email = emailParts.join("\r\n");
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
    };
  }

  async draftEmail(args) {
    this.ensureAuthenticated();

    const { to, subject, body, htmlBody, from, cc, bcc, attachments } = args;

    // Build email headers
    let emailParts = [];
    emailParts.push(`To: ${to.join(", ")}`);
    emailParts.push(`Subject: ${subject}`);

    if (from) {
      emailParts.push(`From: ${from}`);
    }
    if (cc) {
      emailParts.push(`Cc: ${cc.join(", ")}`);
    }
    if (bcc) {
      emailParts.push(`Bcc: ${bcc.join(", ")}`);
    }

    // Build body
    if (htmlBody) {
      emailParts.push("Content-Type: text/html; charset=UTF-8");
      emailParts.push("");
      emailParts.push(htmlBody);
    } else {
      emailParts.push("Content-Type: text/plain; charset=UTF-8");
      emailParts.push("");
      emailParts.push(body);
    }

    const email = emailParts.join("\r\n");
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await this.gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedEmail,
        },
      },
    });

    return {
      success: true,
      draftId: response.data.id,
    };
  }

  async readEmail(messageId) {
    this.ensureAuthenticated();

    const response = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload.headers;

    const getHeader = (name) => {
      const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : null;
    };

    // Extract body
    let body = "";
    if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    } else if (message.payload.parts) {
      const textPart = message.payload.parts.find((p) => p.mimeType === "text/plain");
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeader("from"),
      to: getHeader("to"),
      subject: getHeader("subject"),
      date: getHeader("date"),
      body: body,
      snippet: message.snippet,
    };
  }

  async searchEmails(args) {
    this.ensureAuthenticated();

    const response = await this.gmail.users.messages.list({
      userId: "me",
      q: args.query,
      maxResults: args.maxResults || 10,
    });

    return response.data.messages || [];
  }

  async listEmailLabels() {
    this.ensureAuthenticated();

    const response = await this.gmail.users.labels.list({
      userId: "me",
    });

    return response.data.labels || [];
  }

  // ============ CALENDAR METHODS ============

  async listCalendars() {
    this.ensureAuthenticated();

    const response = await this.calendar.calendarList.list();
    return response.data.items || [];
  }

  async listEvents(args) {
    this.ensureAuthenticated();

    const response = await this.calendar.events.list({
      calendarId: args.calendarId || "primary",
      timeMin: args.timeMin || new Date().toISOString(),
      timeMax: args.timeMax,
      maxResults: args.maxResults || 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  }

  async createEvent(args) {
    this.ensureAuthenticated();

    const event = {
      summary: args.summary,
      description: args.description,
      location: args.location,
      start: {
        dateTime: args.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: args.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (args.attendees) {
      event.attendees = args.attendees.map((email) => ({ email }));
    }

    if (args.reminders) {
      event.reminders = {
        useDefault: false,
        overrides: args.reminders,
      };
    }

    const response = await this.calendar.events.insert({
      calendarId: args.calendarId || "primary",
      requestBody: event,
      sendUpdates: args.attendees ? "all" : "none",
    });

    return response.data;
  }

  async updateEvent(args) {
    this.ensureAuthenticated();

    const event = {};
    if (args.summary) event.summary = args.summary;
    if (args.description) event.description = args.description;
    if (args.location) event.location = args.location;
    if (args.start) {
      event.start = {
        dateTime: args.start,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (args.end) {
      event.end = {
        dateTime: args.end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    if (args.attendees) {
      event.attendees = args.attendees.map((email) => ({ email }));
    }

    const response = await this.calendar.events.patch({
      calendarId: args.calendarId || "primary",
      eventId: args.eventId,
      requestBody: event,
      sendUpdates: args.attendees ? "all" : "none",
    });

    return response.data;
  }

  async deleteEvent(args) {
    this.ensureAuthenticated();

    await this.calendar.events.delete({
      calendarId: args.calendarId || "primary",
      eventId: args.eventId,
    });

    return { success: true, message: "Event deleted" };
  }

  async searchEvents(args) {
    this.ensureAuthenticated();

    const response = await this.calendar.events.list({
      calendarId: args.calendarId || "primary",
      q: args.query,
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      maxResults: args.maxResults || 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  }

  async getFreeBusy(args) {
    this.ensureAuthenticated();

    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        items: (args.calendars || ["primary"]).map((id) => ({ id })),
      },
    });

    return response.data.calendars;
  }

  // ============ TEMPLATE METHODS ============

  async listTemplates() {
    const templates = loadTemplates();
    return Object.entries(templates).map(([key, value]) => ({
      id: key,
      name: value.name,
    }));
  }

  async getTemplate(name) {
    const templates = loadTemplates();
    const template = templates[name];
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }
    return { id: name, ...template };
  }

  async createTemplate(args) {
    const templates = loadTemplates();
    templates[args.name] = {
      name: args.displayName,
      subject: args.subject,
      body: args.body,
    };
    saveTemplates(templates);
    return { success: true, message: `Template '${args.name}' created` };
  }

  async sendTemplateEmail(args) {
    this.ensureAuthenticated();

    const templates = loadTemplates();
    const template = templates[args.template];
    if (!template) {
      throw new Error(`Template '${args.template}' not found`);
    }

    // Apply variables to template
    const subject = applyTemplate(template.subject, args.variables);
    const body = applyTemplate(template.body, args.variables);

    // Send email
    return this.sendEmail({
      to: args.to,
      subject,
      body,
      from: args.from,
      cc: args.cc,
      bcc: args.bcc,
      mimeType: "text/plain",
    });
  }

  // ============ SCHEDULED SEND METHODS ============

  async sendScheduledEmail(args) {
    this.ensureAuthenticated();

    const { to, subject, body, htmlBody, from, scheduledTime, timezone, cc, bcc } = args;

    // Calculate delay
    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    const delayMs = scheduledDate.getTime() - now.getTime();

    if (delayMs <= 0) {
      // Send immediately if scheduled time is in the past
      return this.sendEmail({ to, subject, body, htmlBody, from, cc, bcc, mimeType: "text/plain" });
    }

    // Schedule the email
    const emailId = `scheduled_${Date.now()}`;
    const scheduledEmails = this.scheduledEmails || new Map();
    this.scheduledEmails = scheduledEmails;

    const timeoutId = setTimeout(async () => {
      try {
        await this.sendEmail({ to, subject, body, htmlBody, from, cc, bcc, mimeType: "text/plain" });
        scheduledEmails.delete(emailId);
        console.error(`Scheduled email sent: ${emailId}`);
      } catch (error) {
        console.error(`Failed to send scheduled email ${emailId}:`, error);
      }
    }, delayMs);

    scheduledEmails.set(emailId, {
      timeoutId,
      to,
      subject,
      scheduledTime: scheduledDate.toISOString(),
    });

    return {
      success: true,
      emailId,
      scheduledTime: scheduledDate.toISOString(),
      message: `Email scheduled for ${scheduledDate.toISOString()}`,
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Google Workspace MCP server running on stdio");
  }
}

const server = new GoogleWorkspaceMCP();
server.run().catch(console.error);
