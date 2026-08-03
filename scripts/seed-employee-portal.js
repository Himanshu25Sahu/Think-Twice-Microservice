/**
 * Seeds the Employee Portal project with a connected set of decision entries.
 *
 * Run with mongosh, pointing at whichever cluster you want populated:
 *   mongosh "<MONGO_URI>" --file scripts/seed-employee-portal.js
 *
 * Idempotent: entries are matched on (orgId, projectId, title), so re-running
 * updates the existing documents and rebuilds the relation graph from scratch
 * rather than creating duplicates.
 */

const ORG_ID = '69d2991956df4d9a6f4526d3';
const PROJECT_ID = '69d3e321fcfbb289bce70ca8';
const AUTHOR_ID = '69d2991092b7c2a630e360d2';
const AUTHOR_NAME = 'Himanshu Sahu';

const d = (day) => new Date(Date.UTC(2026, 6, day, 10, 0, 0)); // July 2026

const entries = [
  {
    title: 'Store payroll in its own service with a separate database',
    type: 'architecture',
    createdAt: d(2),
    tags: ['payroll', 'service-boundary', 'pii'],
    what:
      'Salary, bank details, tax declarations and payslips live in a payroll service with its own database and its own credentials. The portal never reads payroll tables directly; it calls a narrow API that returns only what the caller is allowed to see.',
    why:
      'Payroll is the highest-blast-radius data we hold. Keeping it in the shared employee database means every feature team, every migration and every ad-hoc query is one join away from salary rows.\n\nA separate store also gives us a much smaller audit surface. When compliance asks who can read compensation, the answer is a short list of service accounts rather than "anyone with database access".\n\nTrade-off: we lose cross-database joins, so the org chart and the salary band report need two calls and an in-memory merge. That is slower to write and worth it.',
    dos: ['Expose payroll through a task-specific API, never a generic query endpoint'],
    donts: ["Don't replicate payroll fields into the employee record \"for convenience\""],
  },
  {
    title: 'Scope access by reporting line rather than job title',
    type: 'architecture',
    createdAt: d(3),
    tags: ['rbac', 'security', 'authorization'],
    what:
      'Every permission check answers "is this employee in the requester\'s reporting subtree?" instead of "does this requester have the manager role?". The subtree is resolved from the effective-dated manager column at the time of the request.',
    why:
      'Job title is not a permission. A department can hold twelve managers who have no business seeing each other\'s teams, and a title-based check hands all twelve the same access.\n\nReporting line is also the model the business already reasons in. When someone asks "why could they see that?", the answer is a path through the org chart, which HR can read without us translating a role matrix.\n\nTrade-off: subtree checks are more expensive than a role lookup, so we cache the resolved subtree per request and invalidate it on any manager change.',
    dos: ['Resolve the subtree once per request and pass it down explicitly'],
    donts: ["Don't grant access from department membership — departments are not hierarchies"],
  },
  {
    title: 'Payslip PDFs were reachable from a guessable URL',
    type: 'incident',
    createdAt: d(4),
    tags: ['security', 'payroll', 'incident'],
    what:
      'Payslips were stored at /payslips/<employeeId>/<YYYY-MM>.pdf and served straight from object storage. The path contained no secret and the storage bucket had no per-object authorization, so anyone who knew an employee id could fetch their payslip by editing the URL.',
    why:
      'The portal checked authorization when rendering the payslip list and then handed out a direct link, which meant the check protected the page and not the file. Nobody exploited it, but the access logs could not prove that for the first three weeks.\n\nThe fix is short-lived signed URLs minted per download after the reporting-line check, plus an access log entry for every mint. Object storage now denies all public reads.\n\nThe wider lesson: any time we hand out a URL to a file, the authorization has to live on the file, not on the page that linked to it.',
    dos: ['Mint a signed, expiring URL per download and log who minted it'],
    donts: ["Don't treat an unguessable path as an access control — it is not one"],
  },
  {
    title: 'Every HR-visible field change writes an audit event',
    type: 'best-practice',
    createdAt: d(6),
    tags: ['audit', 'compliance', 'observability'],
    what:
      'Writes that touch an employee record emit an audit event carrying the actor, the field, the before and after values, the reason code and the request trace id. Audit events are append-only and are never written by the same code path that performs the update.',
    why:
      'HR disputes are almost always about who changed what and when. Without an audit trail we reconstruct history from application logs, which are sampled, retained for two weeks and not admissible in an internal investigation.\n\nEmitting the event separately from the update matters. If the same function does both, a partial failure silently loses the audit record — which is exactly the case an investigation cares about.\n\nTrade-off: audit volume is large and mostly boring. We accept the storage cost rather than deciding up front which fields will matter later.',
    dos: ['Capture before and after values, not just the field name'],
    donts: ["Don't let a failed audit write be swallowed — fail the request instead"],
  },
  {
    title: 'Self-service profile edits go through maker-checker',
    type: 'feature',
    createdAt: d(8),
    tags: ['self-service', 'maker-checker', 'payroll'],
    what:
      'Employees can edit their address, emergency contact and bank details themselves. Bank detail changes enter a pending state and require HR approval before payroll picks them up; the other fields apply immediately.',
    why:
      'Most profile edits are low risk and were consuming HR time as ticket traffic. Bank details are the exception — a changed account number is the payload of every payroll fraud attempt we have read about.\n\nSplitting the two lets us drop the ticket queue for the common case while keeping a human in the loop for the one field where the attack is worth someone\'s effort.\n\nTrade-off: employees see two different behaviours in the same form, so the pending state has to be visible and explained inline rather than silently queued.',
    dos: ['Show the pending value alongside the current one until approval lands'],
    donts: ["Don't let payroll read a bank change that has not been approved"],
  },
  {
    title: 'Org chart showed stale managers for a week after a reorg',
    type: 'debugging',
    createdAt: d(10),
    tags: ['caching', 'org-chart', 'invalidation'],
    what:
      'The org chart is served from a materialised tree cached under a single key. The reorg updated manager columns correctly, but nothing invalidated the tree, so the portal rendered the pre-reorg hierarchy until the cache was manually flushed.',
    why:
      'The cache key was the project id, so there was no way to invalidate the branch that actually changed — and because the whole tree lived under one key, nobody wanted to blow it away on every manager edit.\n\nWorse, the stale tree was also feeding the reporting-line permission check, so for a week some managers could still see reports who had moved to another team.\n\nThe fix keys the tree by a hierarchy version that any manager write increments. Reads pick up the new version on the next request and the old entry expires on its own.',
    dos: ['Invalidate on the write path, not on a timer'],
    donts: ["Don't let a permission check read from a cache that has no invalidation story"],
  },
  {
    title: 'Publish employee lifecycle events on a queue',
    type: 'architecture',
    createdAt: d(12),
    tags: ['events', 'queue', 'integration'],
    what:
      'Joiner, mover and leaver changes are published as events. Payroll, provisioning, the document vault and the analytics warehouse subscribe. The employee service does not know who consumes them and makes no outbound calls of its own.',
    why:
      'Direct calls meant the employee service held a list of every downstream system, and onboarding a new one was a code change plus a deploy in the service that owns the most sensitive data.\n\nIt also coupled availability. A slow provisioning API turned "HR saves a record" into a timeout, and HR retried, which is how we produced duplicate records more than once.\n\nTrade-off: consumers now see eventual consistency, so anything reading a downstream projection has to tolerate a few seconds of lag. Every consumer must also be idempotent, because redelivery is normal rather than exceptional.',
    dos: ['Give every event a stable id so consumers can deduplicate redeliveries'],
    donts: ["Don't put the full employee record in the event — publish the id and let consumers read"],
  },
  {
    title: 'Nightly full-table sync from the HR system',
    type: 'architecture',
    createdAt: d(1),
    tags: ['legacy', 'batch', 'integration'],
    what:
      'The original integration pulled the entire employee table from the HR system every night at 02:00, truncated the portal copy and reloaded it. Downstream systems read the portal copy the following morning.',
    why:
      'It was the fastest thing to build and it matched how the HR vendor exported data at the time. For a company of two hundred people the full reload took under a minute and nobody noticed.\n\nIt broke down on three fronts: a leaver kept access until the next night, the truncate-and-reload wiped any portal-side field the HR system did not own, and a failed run left the portal with no employee data at all until someone re-ran it by hand.\n\nSuperseded by lifecycle events. Kept here because the failure modes are the argument for the replacement.',
    dos: ['Keep the nightly run as a reconciliation check against the event stream'],
    donts: ["Don't truncate a table that other systems are reading from"],
  },
  {
    title: 'Manager dashboard for the team leave calendar',
    type: 'feature',
    createdAt: d(14),
    tags: ['leave-management', 'manager', 'dashboard'],
    what:
      'Managers get a month view of their direct and indirect reports, showing approved leave, pending requests and public holidays for each report\'s office. Overlapping absences above a configurable threshold are highlighted.',
    why:
      'Approval decisions were being made one request at a time with no view of who else is out. Managers were approving three overlapping weeks and discovering the coverage gap when the first person had already booked flights.\n\nThe overlap threshold is per team rather than global. A four-person support rota and a twenty-person engineering team do not have the same tolerance for simultaneous absence.\n\nTrade-off: the view reads across the reporting subtree, so it is the most expensive page in the portal. It is cached per manager for five minutes and invalidated on any approval.',
    dos: ["Render each report's holidays in that report's office calendar, not the manager's"],
    donts: ["Don't show indirect reports' leave reasons — dates and status are enough"],
  },
  {
    title: 'Store every timestamp in UTC and render in the office timezone',
    type: 'best-practice',
    createdAt: d(15),
    tags: ['timezone', 'dates', 'leave-management'],
    what:
      'All persisted timestamps are UTC. Every employee record carries an office timezone, and rendering converts at the edge. Leave, which is counted in whole days, is stored as a local calendar date with no time component at all.',
    why:
      'Mixing the two representations is what produced the off-by-one leave balances. A leave day is a business concept anchored to the employee\'s calendar, not an instant, and forcing it through a UTC timestamp puts a request submitted at 21:00 IST on the wrong day.\n\nSeparating them means we stop asking "which timezone is this stored in" — instants are always UTC, calendar dates are always local and never converted.\n\nTrade-off: two date types in the schema, and reviewers have to know which one a new field should be. That is a smaller cost than the class of bug it removes.',
    dos: ['Use a date-only type for anything the business counts in days'],
    donts: ["Don't convert a leave date to a timestamp at any point in the pipeline"],
  },
  {
    title: 'Appraisal letter mail-merge went to the wrong recipients',
    type: 'incident',
    createdAt: d(17),
    tags: ['incident', 'email', 'appraisal'],
    what:
      'The annual appraisal mail-merge joined letters to recipients on employee code. Two contractors converted to full-time had been issued new codes while the letter batch was generated against the old ones, so eleven employees received someone else\'s letter, including their revised salary.',
    why:
      'The batch job read the letter list and the recipient list at different times and joined on a business key that HR is allowed to change. Nothing in the pipeline noticed the mismatch because every row joined to something.\n\nThe fix pins the batch to a single snapshot and joins on the immutable internal id. A verification pass now compares the name rendered in each letter against the recipient before anything is sent.\n\nThis is also why bulk sends now require a dry run that a second person signs off, with a sample of ten rendered letters attached.',
    dos: ['Join on immutable internal ids, never on a business key HR can edit'],
    donts: ["Don't send a bulk batch without a dry run someone actually reads"],
  },
  {
    title: 'Document vault with expiry reminders for contracts and IDs',
    type: 'feature',
    createdAt: d(19),
    tags: ['documents', 'compliance', 'reminders'],
    what:
      'Offer letters, contracts, ID proofs and visa documents are stored per employee with an issue and expiry date. The portal notifies the employee and HR at ninety, thirty and seven days before expiry, and flags the record as non-compliant once it lapses.',
    why:
      'Expiry tracking lived in a spreadsheet that one person maintained. Work authorisation lapsing is a legal problem, not an administrative one, and the spreadsheet had no owner while that person was on leave.\n\nThree reminders rather than one is deliberate. Ninety days is when a visa renewal can still be started comfortably, thirty is when it becomes urgent, seven is when it needs escalation.\n\nTrade-off: this puts identity documents in our storage, which raises the stakes on the vault considerably. It ships behind signed URLs and per-document access logging.',
    dos: ['Log every document read with the actor and the reason'],
    donts: ["Don't let a document upload replace an existing one in place — version it"],
  },
  {
    title: 'Soft-delete employee records and never hard-delete',
    type: 'architecture',
    createdAt: d(21),
    tags: ['data-retention', 'compliance', 'soft-delete'],
    what:
      'Removing an employee sets a deactivation date and drops them from every default query through a scope applied at the repository layer. Rows stay for the statutory retention period, after which a scheduled job redacts personal fields in place and keeps the skeleton for payroll history.',
    why:
      'Payroll, tax and audit obligations outlive employment by years, so a hard delete would break historical reports that legally have to reconcile.\n\nApplying the scope at the repository layer rather than in each query is the part that actually matters. Every hand-written filter is a chance to leak a leaver into a headcount report or an active-directory sync.\n\nTrade-off: uniqueness constraints have to account for deactivated rows, so a rehire with the same corporate email needs the constraint scoped to active records only.',
    dos: ['Apply the active scope by default and require an explicit opt-out to see leavers'],
    donts: ["Don't rely on individual queries remembering to filter deactivated rows"],
  },
  {
    title: 'Leave accrual job double-credited employees on retry',
    type: 'debugging',
    createdAt: d(23),
    tags: ['leave-management', 'idempotency', 'jobs'],
    what:
      'The monthly accrual job credits leave to every active employee. A timeout partway through a run triggered the scheduler\'s automatic retry, and because the job appended a credit rather than asserting a balance, everyone processed before the timeout was credited twice.',
    why:
      'The job had no record of which period it had already processed for a given employee. Reruns were assumed to be safe because the job was "just adding the monthly amount", which is exactly the assumption that breaks under retry.\n\nThe fix writes accrual as an upsert keyed on employee and accrual period, so a rerun overwrites the same row instead of appending. The scheduler\'s retry is now harmless and we stopped disabling it during incidents.\n\nReconciling the bad balances took longer than the fix, because approved leave had already been deducted against the inflated numbers.',
    dos: ['Key every periodic job on (entity, period) and upsert'],
    donts: ["Don't assume a job is idempotent because it looks additive — retries prove otherwise"],
  },
];

// source title -> [[target title, relation type], ...]
// Titles are resolved to ids after insertion, so order here does not matter.
const relations = [
  ['Managers could view salary data outside their reporting line', 'Scope access by reporting line rather than job title', 'impacts'],
  ['Scope access by reporting line rather than job title', 'Effective-dated rows for anything HR can change', 'depends_on'],
  ['Scope access by reporting line rather than job title', 'Authenticate through Azure AD SSO instead of portal-managed passwords', 'depends_on'],
  ['Store payroll in its own service with a separate database', 'Scope access by reporting line rather than job title', 'depends_on'],
  ['Payslip PDFs were reachable from a guessable URL', 'Store payroll in its own service with a separate database', 'impacts'],
  ['Payslip PDFs were reachable from a guessable URL', 'Document vault with expiry reminders for contracts and IDs', 'blocks'],
  ['Every HR-visible field change writes an audit event', 'Publish employee lifecycle events on a queue', 'depends_on'],
  ['Effective-dated rows for anything HR can change', 'Every HR-visible field change writes an audit event', 'related_to'],
  ['Self-service profile edits go through maker-checker', 'Every HR-visible field change writes an audit event', 'depends_on'],
  ['Self-service profile edits go through maker-checker', 'Effective-dated rows for anything HR can change', 'impacts'],
  ['Self-service profile edits go through maker-checker', 'Store payroll in its own service with a separate database', 'impacts'],
  ['Org chart showed stale managers for a week after a reorg', 'Scope access by reporting line rather than job title', 'impacts'],
  ['Org chart showed stale managers for a week after a reorg', 'Publish employee lifecycle events on a queue', 'related_to'],
  ['Publish employee lifecycle events on a queue', 'Nightly full-table sync from the HR system', 'replaces'],
  ['Manager dashboard for the team leave calendar', 'Leave approval delegation while a manager is away', 'depends_on'],
  ['Manager dashboard for the team leave calendar', 'Store every timestamp in UTC and render in the office timezone', 'depends_on'],
  ['Leave balances off by one day for employees outside the office timezone', 'Store every timestamp in UTC and render in the office timezone', 'impacts'],
  ['Appraisal letter mail-merge went to the wrong recipients', 'Every HR-visible field change writes an audit event', 'impacts'],
  ['Appraisal letter mail-merge went to the wrong recipients', 'Soft-delete employee records and never hard-delete', 'related_to'],
  ['Document vault with expiry reminders for contracts and IDs', 'Soft-delete employee records and never hard-delete', 'depends_on'],
  ['Document vault with expiry reminders for contracts and IDs', 'Publish employee lifecycle events on a queue', 'depends_on'],
  ['Soft-delete employee records and never hard-delete', 'Effective-dated rows for anything HR can change', 'related_to'],
  ['Leave accrual job double-credited employees on retry', 'Publish employee lifecycle events on a queue', 'impacts'],
  ['Leave accrual job double-credited employees on retry', 'Manager dashboard for the team leave calendar', 'blocks'],
  ['Leave accrual job double-credited employees on retry', 'Leave balances off by one day for employees outside the office timezone', 'related_to'],
];

// --- upsert entries -------------------------------------------------------

let inserted = 0;
let updated = 0;

for (const e of entries) {
  const filter = { orgId: ORG_ID, projectId: PROJECT_ID, title: e.title };
  const existing = db.entries.findOne(filter, { _id: 1 });

  const doc = {
    title: e.title,
    type: e.type,
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    authorId: AUTHOR_ID,
    authorName: AUTHOR_NAME,
    what: e.what,
    why: e.why,
    dos: e.dos,
    donts: e.donts,
    context: '',
    image: '',
    images: [],
    tags: e.tags,
    status: 'published',
    upvotes: [],
    downvotes: [],
    mentions: [],
    createdAt: e.createdAt,
    updatedAt: e.createdAt,
    __v: 0,
  };

  if (existing) {
    db.entries.updateOne(filter, { $set: doc });
    updated += 1;
  } else {
    db.entries.insertOne(Object.assign({ relations: [] }, doc));
    inserted += 1;
  }
}

print(`entries: ${inserted} inserted, ${updated} updated`);

// --- rebuild the relation graph -------------------------------------------

const idByTitle = {};
db.entries
  .find({ orgId: ORG_ID, projectId: PROJECT_ID }, { title: 1 })
  .forEach((doc) => {
    idByTitle[doc.title] = doc._id;
  });

// Clear relations only on entries this script owns, so hand-made relations on
// entries that predate the seed survive a re-run.
const seededTitles = entries.map((e) => e.title);
db.entries.updateMany(
  { orgId: ORG_ID, projectId: PROJECT_ID, title: { $in: seededTitles } },
  { $set: { relations: [] } }
);

const bySource = {};
const missing = [];

for (const [sourceTitle, targetTitle, type] of relations) {
  const sourceId = idByTitle[sourceTitle];
  const targetId = idByTitle[targetTitle];

  if (!sourceId || !targetId) {
    missing.push(`${!sourceId ? sourceTitle : targetTitle}`);
    continue;
  }

  bySource[sourceTitle] = bySource[sourceTitle] || [];
  bySource[sourceTitle].push({
    _id: new ObjectId(),
    targetEntryId: targetId,
    type,
    createdAt: new Date(Date.UTC(2026, 6, 25, 10, 0, 0)),
  });
}

let relationCount = 0;

for (const sourceTitle of Object.keys(bySource)) {
  // $addToSet would compare whole subdocuments including the generated _id, so
  // set the array outright — pre-existing relations on non-seeded entries are
  // preserved by concatenating rather than replacing.
  const source = db.entries.findOne(
    { orgId: ORG_ID, projectId: PROJECT_ID, title: sourceTitle },
    { relations: 1 }
  );

  const existingRelations = (source && source.relations) || [];
  const additions = bySource[sourceTitle].filter(
    (rel) =>
      !existingRelations.some(
        (cur) => cur.targetEntryId.toString() === rel.targetEntryId.toString() && cur.type === rel.type
      )
  );

  if (additions.length === 0) {
    continue;
  }

  db.entries.updateOne(
    { _id: source._id },
    { $push: { relations: { $each: additions } } }
  );

  relationCount += additions.length;
}

print(`relations: ${relationCount} added`);

if (missing.length) {
  print(`WARNING: could not resolve ${missing.length} title(s): ${missing.join(', ')}`);
}

const nodes = db.entries.countDocuments({ orgId: ORG_ID, projectId: PROJECT_ID, status: { $ne: 'archived' } });
const edges = db.entries
  .aggregate([
    { $match: { orgId: ORG_ID, projectId: PROJECT_ID, status: { $ne: 'archived' } } },
    { $project: { n: { $size: { $ifNull: ['$relations', []] } } } },
    { $group: { _id: null, total: { $sum: '$n' } } },
  ])
  .toArray();

print(`graph now: ${nodes} nodes, ${edges.length ? edges[0].total : 0} edges`);
