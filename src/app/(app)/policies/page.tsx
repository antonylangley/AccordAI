import { revalidatePath } from "next/cache";
import { Archive, BadgeCheck, Clock3, FileText, PencilLine, Plus, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import {
  createPolicyRuleFromForm,
  deletePolicyRule,
  getPolicyAdminSnapshot,
  publishPolicyBundle,
  setPolicyRuleStatus,
  updateDraftPolicyRuleFromForm,
  type AccordPolicyRule,
  type PolicyRuleStatus
} from "@/lib/db/accord-store";
import { cn } from "@/lib/utils";
import { PolicyImportPanel } from "./policy-import-panel";

const companySlug = "test-company";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const snapshot = await getPolicyAdminSnapshot(companySlug);
  const draftRules = snapshot.rules.filter((rule) => rule.status === "draft");
  const activeApprovedRules = snapshot.rules.filter((rule) => rule.status === "approved" && rule.active);
  const pendingPublishRules = activeApprovedRules.filter((rule) => !rule.publishedInLatestBundle);
  const publishedApprovedRules = activeApprovedRules.filter((rule) => rule.publishedInLatestBundle);
  const removalPendingRules = snapshot.rules.filter((rule) => rule.publishedInLatestBundle && rule.status !== "approved");
  const pendingPublishCount = pendingPublishRules.length + removalPendingRules.length;
  const previousVersionRules = snapshot.rules.filter((rule) => rule.status === "approved" && !rule.active);
  const rejectedRules = snapshot.rules.filter((rule) => rule.status === "rejected");
  const archivedRules = snapshot.rules.filter((rule) => rule.status === "archived");

  return (
    <div className="space-y-7">
      <PolicyHeader latestBundleVersion={snapshot.latestBundle?.version} pendingPublishCount={pendingPublishCount} />

      <section className="rounded-[1.5rem] border border-accord-border bg-accord-night p-7 text-white shadow-accord-panel">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">Policy enforcement loop</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
              {snapshot.latestBundle ? `Published bundle v${snapshot.latestBundle.version}` : "No published bundle yet"}
            </h2>
            <p className="mt-3 max-w-5xl text-[15px] leading-7 text-slate-300">
              Approved rules are packaged into a signed policy bundle. The extension downloads the published bundle, caches it locally, and records only rule metadata when a decision is applied.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <p className="text-sm font-semibold text-white">Current deployment</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {pendingPublishCount
                ? `${pendingPublishCount} policy change${pendingPublishCount === 1 ? "" : "s"} waiting for the next bundle.`
                : "Policy bundle is current for Accord Guard."}
            </p>
            {snapshot.canMutate ? (
              <form action={publishBundleAction} className="mt-4">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-accord-night shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  Publish bundle
                </button>
              </form>
            ) : (
              <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
                <BadgeCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Bundle active
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <PolicyCount label="Draft" value={draftRules.length} />
          <PolicyCount label="Pending publish" value={pendingPublishCount} />
          <PolicyCount label="Published rules" value={publishedApprovedRules.length} />
          <PolicyCount label="Previous versions" value={previousVersionRules.length} />
          <PolicyCount label="Bundle rules" value={snapshot.latestBundle?.ruleCount || 0} />
        </div>
      </section>

      {pendingPublishCount ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-sm">
          <span className="font-semibold">{pendingPublishCount} policy change{pendingPublishCount === 1 ? "" : "s"} pending publish.</span>{" "}
          {pendingPublishRules.length ? `${pendingPublishRules.length} approved rule${pendingPublishRules.length === 1 ? "" : "s"} will be added or updated. ` : ""}
          {removalPendingRules.length ? `${removalPendingRules.length} published rule${removalPendingRules.length === 1 ? "" : "s"} will be removed from Accord Guard. ` : ""}
          Publish the bundle to ship the latest policy set.
        </section>
      ) : null}

      {!snapshot.enabled ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800 shadow-sm">
          Policy tables are not active yet. Run the latest Supabase migration, then refresh this page.
        </section>
      ) : null}

      <section className="grid items-start gap-6 2xl:grid-cols-[minmax(820px,1fr)_minmax(380px,0.42fr)]">
        <PolicyRuleForm disabled={!snapshot.canMutate} />

        <div className="space-y-6">
          <RuleBucket
            title="Pending publish"
            description="Approved rules waiting for the next published bundle."
            emptyLabel="No pending policy changes."
            rules={pendingPublishRules}
            actionsEnabled={snapshot.canMutate}
          />
          <BundleHistory bundles={snapshot.bundles} />
        </div>
      </section>

      <RuleBucket
        title="Published approved rules"
        description="These active rules are included in the current Accord Guard bundle."
        emptyLabel="No rules in the current published bundle yet."
        rules={publishedApprovedRules}
        actionsEnabled={snapshot.canMutate}
      />

      <section className="space-y-5">
        <RuleBucket title="Draft rules" emptyLabel="No draft rules yet." rules={draftRules} editable actionsEnabled={snapshot.canMutate} />
        <RuleBucket
          title="Previous versions"
          description="Older approved versions stay visible for review but are not included in new bundles."
          emptyLabel="No previous versions yet."
          rules={previousVersionRules}
          actionsEnabled={snapshot.canMutate}
        />
        <RuleBucket title="Rejected rules" emptyLabel="No rejected rules yet." rules={rejectedRules} actionsEnabled={snapshot.canMutate} />
        <RuleBucket
          title="Archived rules"
          description="Archived rules can be restored as drafts or deleted from the authoring table."
          emptyLabel="No archived rules yet."
          rules={archivedRules}
          actionsEnabled={snapshot.canMutate}
        />
      </section>
    </div>
  );
}

async function createRuleAction(formData: FormData) {
  "use server";
  await createPolicyRuleFromForm(formData, companySlug);
  revalidatePath("/policies");
}

async function updateDraftRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await updateDraftPolicyRuleFromForm(ruleId, formData);
  revalidatePath("/policies");
}

async function approveRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "approved");
  revalidatePath("/policies");
}

async function rejectRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "rejected");
  revalidatePath("/policies");
}

async function archiveRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "archived");
  revalidatePath("/policies");
}

async function restoreRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "draft");
  revalidatePath("/policies");
}

async function deleteRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await deletePolicyRule(ruleId);
  revalidatePath("/policies");
}

async function publishBundleAction() {
  "use server";
  await publishPolicyBundle(companySlug);
  revalidatePath("/policies");
}

function PolicyHeader({
  latestBundleVersion,
  pendingPublishCount
}: {
  latestBundleVersion?: number;
  pendingPublishCount: number;
}) {
  return (
    <header className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.9fr)] 2xl:items-end">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accord-primary">Northstar Financial / Policy authoring</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-accord-text">Policies</h1>
        <p className="mt-3 max-w-4xl text-base leading-7 text-accord-muted">
          Define the rules Accord Guard enforces in browser mode: approve policy logic, publish bundles, and keep an audit-ready history without storing raw prompts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HeaderStatus label="Database" value="Supabase live" tone="success" />
        <HeaderStatus label="Guard bundle" value={latestBundleVersion ? `v${latestBundleVersion}` : "Not published"} />
        <HeaderStatus label="Changes" value={pendingPublishCount ? `${pendingPublishCount} pending` : "Current"} tone={pendingPublishCount ? "warning" : "success"} />
      </div>
    </header>
  );
}

function HeaderStatus({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" }) {
  return (
    <div className="rounded-2xl border border-accord-border bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            tone === "success" && "bg-emerald-400",
            tone === "warning" && "bg-amber-400",
            tone === "default" && "bg-accord-primary"
          )}
        />
        <p className="text-sm font-semibold text-accord-text">{value}</p>
      </div>
    </div>
  );
}

function PolicyCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</p>
    </div>
  );
}

function PolicyRuleForm({ disabled }: { disabled: boolean }) {
  if (disabled) return <PolicyAuthoringSetup />;

  return (
    <section className="rounded-[1.6rem] border border-accord-border bg-white/95 p-7 shadow-accord-panel 2xl:p-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[#f1f2ff] p-3 text-accord-primary">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-accord-primary">Policy authoring</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-accord-text">Create policy rule</h2>
            <p className="mt-2 max-w-3xl text-base leading-7 text-accord-muted">
              New rules get their own key from the rule name. Type an existing key only when you intentionally want to create a new version.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-accord-border bg-accord-mist p-4">
          <p className="text-sm font-semibold text-accord-text">Authoring flow</p>
          <p className="mt-2 text-sm leading-6 text-accord-muted">Save draft, approve, then publish the bundle when the set is ready.</p>
        </div>
      </div>

      <div className="mt-7">
        <PolicyImportPanel companySlug={companySlug} />
      </div>

      <div className="mt-8 border-t border-accord-border pt-7">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Manual entry</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-accord-text">Write a rule directly</h3>
          <p className="mt-2 max-w-3xl text-[15px] leading-7 text-accord-muted">
            Use this when you already know the policy control. Imported rules and manual rules both save as drafts first.
          </p>
        </div>

        <form action={createRuleAction} className="mt-6 grid gap-6">
          <PolicyFields />
          <button
            type="submit"
            className="rounded-xl bg-accord-night px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            Save draft rule
          </button>
        </form>
      </div>
    </section>
  );
}

function PolicyAuthoringSetup() {
  return (
    <section className="rounded-[1.35rem] border border-accord-border bg-white/95 p-6 shadow-accord-panel">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#f1f2ff] p-2 text-accord-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-accord-text">Enable policy authoring</h2>
          <p className="mt-1 text-[15px] leading-6 text-accord-muted">
            The published v1 bundle is active for Accord Guard, but Supabase REST has not exposed the policy authoring tables yet.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-accord-border bg-accord-mist p-4">
        <p className="text-sm font-semibold text-accord-text">To add or edit rules:</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>Run this in the Supabase SQL Editor.</li>
          <li>Wait a few seconds, then refresh this page.</li>
          <li>Use the form to save a draft, approve it, then publish the bundle.</li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-accord-night p-4 text-xs leading-6 text-slate-100">
{`grant usage on schema public to anon, authenticated, service_role;
grant all on table public.accord_policy_rules to anon, authenticated, service_role;
grant all on table public.accord_policy_bundles to anon, authenticated, service_role;
notify pgrst, 'reload schema';`}
        </pre>
      </div>
    </section>
  );
}

function PolicyFields({ rule }: { rule?: AccordPolicyRule }) {
  const isEditing = Boolean(rule);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Field label="Rule name" name="name" defaultValue={rule?.name || ""} placeholder="e.g. Block HR data in personal AI" />
        <Field
          label="Rule key"
          name="ruleKey"
          defaultValue={rule?.ruleKey || ""}
          placeholder={isEditing ? "existing_rule_key" : "Auto-generated from rule name"}
        />
        <Field label="Source policy" name="sourcePolicyName" defaultValue={rule?.sourcePolicyName || "External AI Usage Policy"} />
        <Field label="Source section / citation" name="sourceSection" defaultValue={rule?.sourceSection || "4.2 - Client Information"} />
        <Field label="User scope" name="userScope" defaultValue={rule?.userScope || "all"} />
        <Field label="Department scope" name="departmentScope" defaultValue={rule?.departmentScope || "all"} />
        <SelectField
          label="AI provider"
          name="aiProvider"
          defaultValue={rule?.aiProvider || "chatgpt"}
          options={["any", "chatgpt", "openai", "anthropic", "gemini", "internal"]}
        />
        <SelectField
          label="Destination/account type"
          name="destinationType"
          defaultValue={rule?.destinationType || "personal"}
          options={["any", "approved", "enterprise", "personal", "unapproved"]}
        />
        <SelectField label="Action" name="action" defaultValue={rule?.action || "transform"} options={["allow", "transform", "warn", "require_approval", "block"]} />
        <SelectField
          label="Fallback action"
          name="fallbackAction"
          defaultValue={rule?.fallbackAction || "block"}
          options={["allow", "transform", "warn", "require_approval", "block"]}
        />
        <SelectField label="Severity" name="severity" defaultValue={rule?.severity || "high"} options={["low", "medium", "high", "critical"]} />
        <Field label="Effective date" name="effectiveDate" type="date" defaultValue={rule?.effectiveDate || new Date().toISOString().slice(0, 10)} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(280px,0.65fr)_minmax(0,1.35fr)]">
        <TextArea
          label="Data categories"
          name="dataCategories"
          defaultValue={
            rule?.dataCategories.join(", ") ||
            "client_identifying_info, personal_data, address, account, veterinary_medical_record, payment_information"
          }
          rows={5}
        />
        <TextArea
          label="Supporting excerpt"
          name="supportingExcerpt"
          defaultValue={
            rule?.supportingExcerpt ||
            "Employees must not submit client names, addresses, account numbers, veterinary medical records, payment information, or other identifying information to personal or unapproved AI services. When identifying information can be removed without preventing the task, it must be removed before submission. If adequate de-identification is not possible, the submission must be blocked or routed for approval."
          }
          rows={5}
        />
      </div>

      <TextArea
        label="Employee-facing explanation"
        name="employeeExplanation"
        defaultValue={
          rule?.employeeExplanation ||
          "Client identifying information cannot be sent to personal AI. Accord will remove identifiers when it can do so safely, otherwise the submission is blocked or routed for approval."
        }
        rows={3}
      />
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <input
        className="rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-accord-primary"
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return (
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <select
        className="rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-accord-primary"
        name={name}
        defaultValue={defaultValue}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, name, defaultValue, rows }: { label: string; name: string; defaultValue: string; rows: number }) {
  return (
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <textarea
        className="resize-y rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium leading-6 text-slate-700 outline-none transition focus:border-accord-primary"
        name={name}
        defaultValue={defaultValue}
        rows={rows}
      />
    </label>
  );
}

function RuleBucket({
  title,
  description,
  rules,
  emptyLabel,
  editable = false,
  actionsEnabled = true
}: {
  title: string;
  description?: string;
  rules: AccordPolicyRule[];
  emptyLabel: string;
  editable?: boolean;
  actionsEnabled?: boolean;
}) {
  return (
    <section className="rounded-[1.35rem] border border-accord-border bg-white/95 p-6 shadow-accord-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-accord-text">{title}</h2>
        <span className="rounded-full bg-[#f1f2ff] px-3 py-1 text-xs font-semibold text-accord-primary">{rules.length}</span>
      </div>
      {description ? <p className="mt-2 text-[15px] leading-6 text-accord-muted">{description}</p> : null}

      <div className="mt-5 grid gap-4">
        {rules.length ? (
          rules.map((rule) => <PolicyRuleCard key={rule.id} rule={rule} editable={editable && actionsEnabled} actionsEnabled={actionsEnabled} />)
        ) : (
          <p className="rounded-2xl border border-dashed border-accord-border bg-accord-mist p-5 text-sm text-accord-muted">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function PolicyRuleCard({ rule, editable, actionsEnabled }: { rule: AccordPolicyRule; editable: boolean; actionsEnabled: boolean }) {
  return (
    <article className="rounded-2xl border border-accord-border bg-white p-5 shadow-sm">
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.25fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={rule.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">rule v{rule.version}</span>
            {rule.status === "approved" ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  rule.publishedInLatestBundle && "bg-emerald-50 text-emerald-700",
                  rule.active && !rule.publishedInLatestBundle && "bg-amber-50 text-amber-700",
                  !rule.active && "bg-slate-100 text-slate-500"
                )}
              >
                {rule.publishedInLatestBundle
                  ? `published in bundle v${rule.publishedInBundleVersion}`
                  : rule.active
                    ? "pending publish"
                    : "previous rule version"}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-[17px] font-semibold leading-6 text-accord-text">{rule.name}</h3>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">{rule.ruleKey}</p>
          <p className="mt-1 text-[13px] leading-6 text-accord-muted">
            {rule.sourcePolicyName} {rule.sourceSection}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[15px] leading-7 text-slate-600">{rule.employeeExplanation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {rule.dataCategories.slice(0, 6).map((category) => (
              <span key={category} className="rounded-full bg-[#f1f2ff] px-2.5 py-1 text-[12px] font-semibold text-accord-primary">
                {category.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {actionsEnabled && rule.status === "draft" ? (
            <>
              <RuleActionButton action={approveRuleAction} ruleId={rule.id} label="Approve" icon="approve" />
              <RuleActionButton action={rejectRuleAction} ruleId={rule.id} label="Reject" />
            </>
          ) : null}
          {actionsEnabled && rule.status === "approved" ? <RuleActionButton action={archiveRuleAction} ruleId={rule.id} label="Archive" icon="archive" /> : null}
          {actionsEnabled && rule.status === "archived" ? (
            <>
              <RuleActionButton action={restoreRuleAction} ruleId={rule.id} label="Restore draft" icon="restore" />
              <RuleActionButton action={deleteRuleAction} ruleId={rule.id} label="Delete" icon="delete" tone="danger" />
            </>
          ) : null}
        </div>
      </div>

      {editable ? (
        <details className="mt-4 rounded-xl border border-accord-border bg-accord-mist p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-accord-text">
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            Edit draft
          </summary>
          <form action={updateDraftRuleAction} className="mt-4 grid gap-4">
            <input type="hidden" name="ruleId" value={rule.id} />
            <PolicyFields rule={rule} />
            <button type="submit" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-accord-text shadow-sm ring-1 ring-accord-border">
              Save draft changes
            </button>
          </form>
        </details>
      ) : null}
    </article>
  );
}

function RuleActionButton({
  action,
  ruleId,
  label,
  icon,
  tone = "default"
}: {
  action: (formData: FormData) => Promise<void>;
  ruleId: string;
  label: string;
  icon?: "approve" | "archive" | "restore" | "delete";
  tone?: "default" | "danger";
}) {
  const Icon = icon === "approve" ? BadgeCheck : icon === "archive" ? Archive : icon === "restore" ? RotateCcw : icon === "delete" ? Trash2 : FileText;

  return (
    <form action={action}>
      <input type="hidden" name="ruleId" value={ruleId} />
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition",
          tone === "danger"
            ? "border-rose-200 text-rose-700 hover:border-rose-400 hover:text-rose-800"
            : "border-accord-border text-accord-text hover:border-accord-primary hover:text-accord-primary"
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

function StatusPill({ status }: { status: PolicyRuleStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "approved" && "bg-emerald-50 text-emerald-700",
        status === "draft" && "bg-amber-50 text-amber-700",
        status === "rejected" && "bg-rose-50 text-rose-700",
        status === "archived" && "bg-slate-100 text-slate-600"
      )}
    >
      {status}
    </span>
  );
}

function BundleHistory({ bundles }: { bundles: Array<{ id: string; version: number; status: string; checksum: string; ruleCount: number; publishedAt: string }> }) {
  return (
    <section className="rounded-[1.35rem] border border-accord-border bg-white/95 p-6 shadow-accord-panel">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#f1f2ff] p-2 text-accord-primary">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-accord-text">Policy bundle history</h2>
          <p className="mt-1 text-[15px] leading-6 text-accord-muted">Published bundles are what Accord Guard can fetch and cache.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {bundles.length ? (
          bundles.map((bundle) => (
            <div key={bundle.id} className="flex flex-col gap-2 rounded-xl border border-accord-border bg-accord-mist px-4 py-3.5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[15px] font-semibold text-accord-text">
                  v{bundle.version} <span className="font-normal text-slate-500">{bundle.status}</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{bundle.checksum.slice(0, 24)}</p>
              </div>
              <p className="text-sm font-semibold text-slate-600">{bundle.ruleCount} rules</p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-accord-border bg-accord-mist p-5 text-sm text-accord-muted">
            Publish approved rules to create the first bundle.
          </p>
        )}
      </div>
    </section>
  );
}
