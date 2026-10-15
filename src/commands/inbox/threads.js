/**
 * helpscout inbox thread <action>
 */
import { Command } from 'commander';
import {
  mailbox,
  buildCreateNoteRequest,
  buildCreateReplyRequest,
  getConversationByIdOrNumber,
} from '../../mailbox-client.js';
import { output, outputTable } from '../../output.js';
import { resolveTextOrFile } from '../../text-or-file.js';

const COLUMNS = [
  { key: 'id', header: 'ID' },
  { key: 'type', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Created' },
  { key: 'createdBy', header: 'Author' },
];

function flattenThread(t) {
  return {
    ...t,
    createdBy: t.createdBy
      ? `${t.createdBy.first ?? ''} ${t.createdBy.last ?? ''}`.trim() || t.createdBy.email
      : '',
  };
}

export function makeThreadCommand() {
  const cmd = new Command('thread');
  cmd.description('Manage conversation threads');

  cmd
    .command('list <conversationIdOrNumber>')
    .description('List threads for a conversation (by ID or web UI number)')
    .option('--all', 'Fetch all pages')
    .action(async (idOrNumber, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const { id: conversationId } = await getConversationByIdOrNumber(idOrNumber);
      if (opts.all) {
        const items = await mailbox.getAll(`/conversations/${conversationId}/threads`, 'threads');
        outputTable(items.map(flattenThread), COLUMNS, globalOpts);
      } else {
        const data = await mailbox.get(`/conversations/${conversationId}/threads`);
        const items = data?._embedded?.threads ?? [];
        outputTable(items.map(flattenThread), COLUMNS, globalOpts);
      }
    });

  cmd
    .command('reply <conversationId>')
    .description('Create a reply thread (conversation ID or web UI number)')
    .option('--text <text>', 'Reply text (HTML allowed; required unless --file)')
    .option('--file <path>', 'Read reply text from file (alternative to --text)')
    .option('--user <userId>', 'Author user ID')
    .option('--cc <emails>', 'Comma-separated CC addresses')
    .option('--bcc <emails>', 'Comma-separated BCC addresses')
    .option('--draft', 'Save as a draft instead of sending')
    .action(async (conversationId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const text = await resolveTextOrFile({
        text: opts.text,
        filePath: opts.file,
        required: true,
        paramNames: { text: '--text', file: '--file' },
      });
      const conversation = await getConversationByIdOrNumber(conversationId);
      const splitList = (v) => v?.split(',').map((s) => s.trim());
      const { path, body } = buildCreateReplyRequest(conversation.id, {
        customerId: conversation.primaryCustomer?.id,
        text,
        user: opts.user ? parseInt(opts.user, 10) : undefined,
        cc: splitList(opts.cc),
        bcc: splitList(opts.bcc),
        draft: opts.draft,
      });
      await mailbox.post(path, body);
      output({ ok: true, id: conversation.id, draft: !!opts.draft }, globalOpts);
    });

  cmd
    .command('note <conversationId>')
    .description('Create an internal note')
    .option('--text <text>', 'Note text (HTML allowed; required unless --file)')
    .option('--file <path>', 'Read note text from file (alternative to --text)')
    .option('--user <userId>', 'Author user ID')
    .action(async (conversationId, opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals();
      const text = await resolveTextOrFile({
        text: opts.text,
        filePath: opts.file,
        required: true,
        paramNames: { text: '--text', file: '--file' },
      });
      const { path, body } = buildCreateNoteRequest(conversationId, {
        text,
        user: opts.user ? parseInt(opts.user, 10) : undefined,
      });
      await mailbox.post(path, body);
      output({ ok: true }, globalOpts);
    });

  return cmd;
}
