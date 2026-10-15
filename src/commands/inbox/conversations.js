/**
 * helpscout inbox conversation <action>
 */
import { Command } from 'commander';
import { mailbox, getConversationByIdOrNumber } from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';
import { resolveTextOrFile } from '../../text-or-file.js';
import { formatTranscript } from '../../transcript.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'number', header: 'Number' },
  { key: 'subject', header: 'Subject' },
  { key: 'status', header: 'Status' },
  { key: 'mailboxId', header: 'Mailbox' },
  { key: 'assignee', header: 'Assignee' },
  { key: 'createdAt', header: 'Created' },
];

function flattenConversation(c) {
  return {
    ...c,
    assignee: c.assignee ? `${c.assignee.first} ${c.assignee.last}` : '',
  };
}

export function makeConversationCommand() {
  const cmd = new Command('conversation');
  cmd.description('Manage conversations');

  cmd
    .command('list')
    .description('List conversations')
    .option('--mailbox <id>', 'Filter by mailbox ID')
    .option('--status <status>', 'Filter by status (active, closed, spam, pending)', 'active')
    .option('--tag <tag>', 'Filter by tag')
    .option('--assigned-to <userId>', 'Filter by assigned user ID')
    .option(
      '--number <n>',
      'Find by conversation number shown in the web UI (searches all statuses)',
    )
    .option('--page <n>', 'Page number', '1')
    .option('--all', 'Fetch all pages')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const params = {};
      if (opts.mailbox) params.mailbox = opts.mailbox;
      if (opts.status) params.status = opts.status;
      if (opts.tag) params.tag = opts.tag;
      if (opts.assignedTo) params.assignedTo = opts.assignedTo;
      if (opts.number) {
        params.number = opts.number;
        // A number is unique; don't let the default `active` status hide it.
        if (cmd.getOptionValueSource('status') === 'default') params.status = 'all';
      }

      if (opts.all) {
        const items = await mailbox.getAll('/conversations', 'conversations', params);
        outputTable(items.map(flattenConversation), COLUMNS, globalOpts);
      } else {
        params.page = opts.page;
        const data = await mailbox.get('/conversations', params);
        const items = data?._embedded?.conversations ?? [];
        outputTable(items.map(flattenConversation), COLUMNS, globalOpts);
      }
    });

  cmd
    .command('get <idOrNumber>')
    .description('Get a conversation by ID or by the number shown in the web UI')
    .option('--threads', 'Include all threads (full message bodies); shown as a transcript')
    .action(async (idOrNumber, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      if (opts.threads) {
        const data = await getConversationByIdOrNumber(idOrNumber, {
          params: { embed: 'threads' },
        });
        output(data, globalOpts, formatTranscript);
        return;
      }
      const data = await getConversationByIdOrNumber(idOrNumber);
      output(data, globalOpts);
    });

  cmd
    .command('create')
    .description('Create a conversation')
    .requiredOption('--subject <subject>', 'Subject')
    .requiredOption('--mailbox-id <id>', 'Mailbox ID')
    .requiredOption('--customer-email <email>', 'Customer email')
    .option('--body <text>', 'Initial message body')
    .option('--file <path>', 'Read initial message body from file (alternative to --body)')
    .option('--status <status>', 'Status (active, closed, pending)', 'active')
    .option('--type <type>', 'Conversation type (email, chat, phone)', 'email')
    .option('--tag <tag...>', 'Tags to apply')
    .option('--assigned-to <userId>', 'User ID to assign to')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const messageBody = await resolveTextOrFile({
        text: opts.body,
        filePath: opts.file,
        required: false,
        paramNames: { text: '--body', file: '--file' },
      });
      const body = {
        subject: opts.subject,
        mailboxId: parseInt(opts.mailboxId),
        customer: { email: opts.customerEmail },
        status: opts.status,
        type: opts.type,
      };
      if (messageBody) {
        body.threads = [{ type: 'customer', text: messageBody }];
      }
      if (opts.tag) body.tags = opts.tag;
      if (opts.assignedTo) body.assignTo = parseInt(opts.assignedTo);

      const data = await mailbox.post('/conversations', body);
      output(data ?? { ok: true }, globalOpts);
    });

  cmd
    .command('update <id>')
    .description('Update a conversation')
    .option('--status <status>', 'New status (active, closed, spam, pending)')
    .option('--subject <subject>', 'New subject')
    .option('--assigned-to <userId>', 'Assign to user ID')
    .option('--mailbox <id>', 'Move to mailbox ID')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const body = {};
      if (opts.status) body.status = opts.status;
      if (opts.subject) body.subject = opts.subject;
      if (opts.assignedTo) body.assignTo = parseInt(opts.assignedTo);
      if (opts.mailbox) body.mailboxId = parseInt(opts.mailbox);

      await mailbox.patch(`/conversations/${id}`, body);
      output({ ok: true, id }, globalOpts);
    });

  cmd
    .command('delete <id>')
    .description('Delete a conversation')
    .action(async (id, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      await mailbox.delete(`/conversations/${id}`);
      output({ ok: true, id }, globalOpts);
    });

  return cmd;
}
