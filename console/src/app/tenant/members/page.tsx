"use client";

import * as React from "react";
import { CreditCard, LoaderCircle, Pencil, Printer, ShieldCheck, Trash2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ResourceTable, StatusBadgeText, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useTenantSession } from "@/hooks/use-tenant-session";
import {
  TenantApiError,
  saveBlob,
  tenantApi,
  tenantDownload,
  uploadTenantFile,
} from "@/lib/tenant-api";
import { uploadUrl } from "@/lib/api";

type MemberStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "PENDING"
  | "SUSPENDED"
  | "EXPIRED"
  | "DELETED";

/** The business setting naming the position new members default to. */
const DEFAULT_POSITION_KEY = "memberRegister.positionId";

/**
 * The lifecycle states a human may set. DELETED is reached only by DELETE.
 *
 * SUSPENDED and EXPIRED were retired - they duplicated INACTIVE and nothing
 * acted on the difference. They stay in `MemberStatus` above because the
 * database can still return them for a row written before the change, and the
 * status badge renders any string; this list is only what may be CHOSEN.
 */
const SETTABLE_STATUSES: Exclude<MemberStatus, "DELETED">[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
];

interface MemberRow {
  id: string;
  systemCode: string;
  /** Generated at enrolment as <rtoCode><sequence>; never editable here. */
  memberIdNumber: string;
  tenantBusinessId: string;
  memberName: string;
  memberNameTamil: string | null;
  businessName: string;
  businessNameTamil: string | null;
  associationPositionId: string;
  industryId: string;
  /** The number itself is never sent - only these four digits. */
  aadhaarLast4: string;
  phoneNumber: string;
  whatsappNumber: string | null;
  email: string;
  stateId: string;
  districtId: string;
  talukId: string;
  rtoId: string;
  addressLine1: string;
  addressLine2: string | null;
  dateOfBirth: string;
  isMarried: boolean;
  weddingDate: string | null;
  passportPhotoPath: string | null;
  remark: string | null;
  status: MemberStatus;
  tenantBusiness?: { id: string; name: string };
  associationPosition?: { id: string; positionName: string };
  industry?: { id: string; industryName: string };
  state?: { id: string; stateName: string };
  district?: { id: string; districtName: string };
  taluk?: { id: string; talukName: string };
}

interface Opt {
  id: string;
  name: string;
}

interface FormValues {
  tenantBusinessId: string;
  memberName: string;
  memberNameTamil: string;
  businessName: string;
  businessNameTamil: string;
  associationPositionId: string;
  industryId: string;
  /** Blank on edit means "leave the stored number alone". */
  aadhaarNumber: string;
  phoneNumber: string;
  whatsappNumber: string;
  email: string;
  stateId: string;
  districtId: string;
  talukId: string;
  rtoId: string;
  addressLine1: string;
  addressLine2: string;
  dateOfBirth: string;
  isMarried: boolean;
  weddingDate: string;
  passportPhotoPath: string;
  remark: string;
}

const EMPTY_FORM: FormValues = {
  tenantBusinessId: "",
  memberName: "",
  memberNameTamil: "",
  businessName: "",
  businessNameTamil: "",
  associationPositionId: "",
  industryId: "",
  aadhaarNumber: "",
  phoneNumber: "",
  whatsappNumber: "",
  email: "",
  stateId: "",
  districtId: "",
  talukId: "",
  rtoId: "",
  addressLine1: "",
  addressLine2: "",
  dateOfBirth: "",
  isMarried: false,
  weddingDate: "",
  passportPhotoPath: "",
  remark: "",
};

export default function TenantMembersPage() {
  const { hasPermission } = useTenantSession();

  const canView = hasPermission("tenant-members:list");
  const canCreate = hasPermission("tenant-members:create");
  const canUpdate = hasPermission("tenant-members:update");
  const canDelete = hasPermission("tenant-members:delete");
  const canChangeStatus = hasPermission("tenant-members:change_status");
  const canGenerateCard = hasPermission("tenant-member-id-cards:generate");
  const [cardBusyId, setCardBusyId] = React.useState<string | null>(null);
  const [bulkPrinting, setBulkPrinting] = React.useState(false);

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const list = useResourceList<MemberRow>("/tenant/members", { status: statusFilter || undefined }, tenantApi);

  const [businessOptions, setBusinessOptions] = React.useState<Opt[] | null>(null);
  const [positionOptions, setPositionOptions] = React.useState<Opt[] | null>(null);
  const [industryOptions, setIndustryOptions] = React.useState<Opt[] | null>(null);
  const [stateOptions, setStateOptions] = React.useState<Opt[] | null>(null);
  const [districtOptions, setDistrictOptions] = React.useState<Opt[] | null>(null);
  const [talukOptions, setTalukOptions] = React.useState<Opt[] | null>(null);
  const [rtoOptions, setRtoOptions] = React.useState<Opt[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MemberRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<MemberRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [statusTarget, setStatusTarget] = React.useState<MemberRow | null>(null);
  const [nextStatus, setNextStatus] = React.useState<string>("ACTIVE");
  const [changingStatus, setChangingStatus] = React.useState(false);

  function loadBusinessOptions(): Promise<Opt[]> {
    if (businessOptions) return Promise.resolve(businessOptions);
    return tenantApi<Opt[]>("/tenant/members/businesses")
      .then((d) => {
        setBusinessOptions(d);
        return d;
      })
      .catch(() => {
        toast.error("Failed to load your businesses");
        return [];
      });
  }

  /** Everything below the business, cleared together. */
  function resetCascade() {
    setPositionOptions(null);
    setIndustryOptions(null);
    setStateOptions(null);
    setDistrictOptions(null);
    setTalukOptions(null);
  }

  /** Loads the four lists that hang directly off a business. */
  function loadForBusiness(tenantBusinessId: string) {
    if (!tenantBusinessId) return;
    const q = `?tenantBusinessId=${tenantBusinessId}&limit=200&status=ACTIVE`;
    tenantApi<{ items: { id: string; positionName: string }[] }>(`/tenant/association-positions${q}`)
      .then((d) => setPositionOptions(d.items.map((x) => ({ id: x.id, name: x.positionName }))))
      .catch(() => toast.error("Failed to load positions"));
    tenantApi<{ items: { id: string; industryName: string }[] }>(`/tenant/industries${q}`)
      .then((d) => setIndustryOptions(d.items.map((x) => ({ id: x.id, name: x.industryName }))))
      .catch(() => toast.error("Failed to load industries"));
    tenantApi<{ items: { id: string; stateName: string }[] }>(`/tenant/states${q}`)
      .then((d) => setStateOptions(d.items.map((x) => ({ id: x.id, name: x.stateName }))))
      .catch(() => toast.error("Failed to load states"));
    loadDefaultPosition();
  }

  /**
   * Pre-fills the position from the business's `memberRegister.positionId`.
   *
   * The same setting FIXES the position on public applications; here it is
   * only a default. Staff must still be able to enrol a Secretary directly, so
   * this fills an empty field and never overrides a chosen one.
   *
   * Failure is silent on purpose: reading settings carries its own permission,
   * and somebody who may create members but not read settings should still get
   * a working form rather than an error they cannot act on.
   */
  function loadDefaultPosition() {
    tenantApi<{ settingKey: string; settingValue: string | null }[]>(
      "/tenant/business-settings",
    )
      .then((rows) => {
        const fixed = rows.find((r) => r.settingKey === DEFAULT_POSITION_KEY)?.settingValue;
        if (!fixed) return;
        setForm((f) => (f.associationPositionId ? f : { ...f, associationPositionId: fixed }));
      })
      .catch(() => {});
  }

  function loadDistricts(tenantBusinessId: string, stateId: string) {
    if (!(tenantBusinessId && stateId)) {
      setDistrictOptions([]);
      return;
    }
    tenantApi<{ items: { id: string; districtName: string }[] }>(
      `/tenant/districts?tenantBusinessId=${tenantBusinessId}&stateId=${stateId}&limit=200&status=ACTIVE`,
    )
      .then((d) => setDistrictOptions(d.items.map((x) => ({ id: x.id, name: x.districtName }))))
      .catch(() => toast.error("Failed to load districts"));
  }

  function loadTaluks(tenantBusinessId: string, districtId: string) {
    if (!(tenantBusinessId && districtId)) {
      setTalukOptions([]);
      return;
    }
    tenantApi<{ items: { id: string; talukName: string }[] }>(
      `/tenant/taluks?tenantBusinessId=${tenantBusinessId}&districtId=${districtId}&limit=200&status=ACTIVE`,
    )
      .then((d) => setTalukOptions(d.items.map((x) => ({ id: x.id, name: x.talukName }))))
      .catch(() => toast.error("Failed to load taluks"));
  }

  // RTOs hang off the DISTRICT, not the taluk that sits above them on the
  // form. Filtering by talukId here would silently return nothing.
  function loadRtos(tenantBusinessId: string, districtId: string) {
    if (!(tenantBusinessId && districtId)) {
      setRtoOptions([]);
      return;
    }
    tenantApi<{ items: { id: string; rtoName: string; rtoCode: string }[] }>(
      `/tenant/rtos?tenantBusinessId=${tenantBusinessId}&tenantDistrictId=${districtId}&limit=200&status=ACTIVE`,
    )
      .then((d) =>
        setRtoOptions(d.items.map((x) => ({ id: x.id, name: `${x.rtoCode} — ${x.rtoName}` }))),
      )
      .catch(() => toast.error("Failed to load RTOs"));
  }

  // Each change clears everything beneath it, so the form can never hold a
  // district from one state next to a taluk from another - which the API
  // would reject anyway, but far later and less legibly.
  function onBusinessChange(tenantBusinessId: string) {
    setForm((f) => ({
      ...f,
      tenantBusinessId,
      associationPositionId: "",
      industryId: "",
      stateId: "",
      districtId: "",
      talukId: "",
    }));
    resetCascade();
    loadForBusiness(tenantBusinessId);
  }

  function onStateChange(stateId: string) {
    setForm((f) => ({ ...f, stateId, districtId: "", talukId: "", rtoId: "" }));
    setTalukOptions(null);
    loadDistricts(form.tenantBusinessId, stateId);
  }

  function onDistrictChange(districtId: string) {
    setForm((f) => ({ ...f, districtId, talukId: "", rtoId: "" }));
    loadTaluks(form.tenantBusinessId, districtId);
    loadRtos(form.tenantBusinessId, districtId);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    resetCascade();
    setFormOpen(true);
    loadBusinessOptions().then((opts) => {
      if (opts.length === 1) {
        setForm((f) => ({ ...f, tenantBusinessId: opts[0].id }));
        loadForBusiness(opts[0].id);
      }
    });
  }

  function openEdit(row: MemberRow) {
    loadBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      memberName: row.memberName,
      memberNameTamil: row.memberNameTamil ?? "",
      businessName: row.businessName,
      businessNameTamil: row.businessNameTamil ?? "",
      associationPositionId: row.associationPositionId,
      industryId: row.industryId,
      // Always blank: the server never sends the number back, and blank is
      // what tells it to keep the stored one.
      aadhaarNumber: "",
      phoneNumber: row.phoneNumber,
      whatsappNumber: row.whatsappNumber ?? "",
      email: row.email,
      stateId: row.stateId,
      districtId: row.districtId,
      talukId: row.talukId,
      rtoId: row.rtoId,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2 ?? "",
      dateOfBirth: row.dateOfBirth,
      isMarried: row.isMarried,
      weddingDate: row.weddingDate ?? "",
      passportPhotoPath: row.passportPhotoPath ?? "",
      remark: row.remark ?? "",
    });
    loadForBusiness(row.tenantBusinessId);
    loadDistricts(row.tenantBusinessId, row.stateId);
    loadTaluks(row.tenantBusinessId, row.districtId);
    loadRtos(row.tenantBusinessId, row.districtId);
    setFormOpen(true);
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared so picking the same file twice still fires a change.
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { path } = await uploadTenantFile(file);
      setForm((f) => ({ ...f, passportPhotoPath: path }));
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        tenantBusinessId: form.tenantBusinessId,
        memberName: form.memberName,
        memberNameTamil: form.memberNameTamil || undefined,
        businessName: form.businessName,
        businessNameTamil: form.businessNameTamil || undefined,
        associationPositionId: form.associationPositionId,
        industryId: form.industryId,
        // Omitted entirely when blank, so an edit leaves the stored number be.
        ...(form.aadhaarNumber ? { aadhaarNumber: form.aadhaarNumber } : {}),
        phoneNumber: form.phoneNumber,
        whatsappNumber: form.whatsappNumber || undefined,
        email: form.email,
        stateId: form.stateId,
        districtId: form.districtId,
        talukId: form.talukId,
        rtoId: form.rtoId,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || undefined,
        dateOfBirth: form.dateOfBirth,
        isMarried: form.isMarried,
        // Null rather than undefined: on edit this must actively clear a
        // stored date when the member is no longer recorded as married.
        weddingDate: form.isMarried ? form.weddingDate || undefined : null,
        passportPhotoPath: form.passportPhotoPath || undefined,
        remark: form.remark || undefined,
      };
      if (editing) {
        await tenantApi(`/tenant/members/${editing.id}`, { method: "PATCH", body });
        toast.success("Member updated");
      } else {
        await tenantApi("/tenant/members", { method: "POST", body });
        toast.success("Member enrolled");
      }
      setFormOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Generates one member's card, then downloads it.
   *
   * Two requests on purpose: the first renders and STORES the card, the
   * second streams it. The card stays downloadable afterwards, so this is not
   * a one-shot export.
   */
  async function generateCard(row: MemberRow) {
    setCardBusyId(row.id);
    try {
      const card = await tenantApi<{ id: string }>(
        `/tenant/member-id-cards/members/${row.id}`,
        { method: "POST", body: {} },
      );
      const blob = await tenantDownload(`/tenant/member-id-cards/${card.id}/download`);
      saveBlob(blob, `${row.systemCode}.pdf`);
      toast.success(`ID card generated for ${row.memberName}`);
    } catch (error) {
      toast.error(
        error instanceof TenantApiError ? error.message : "Could not generate the card",
      );
    } finally {
      setCardBusyId(null);
    }
  }

  /**
   * Generates cards for everyone on the current page as one printable PDF.
   *
   * Scoped to what is on screen rather than to the whole register, so the
   * operator can see exactly whose cards they are about to produce - and the
   * server caps the batch regardless.
   */
  async function printVisibleCards() {
    // Nullable while loading; the button is disabled then anyway.
    const rows = list.rows ?? [];
    if (rows.length === 0) return;
    setBulkPrinting(true);
    try {
      const blob = await tenantDownload("/tenant/member-id-cards/bulk", {
        method: "POST",
        body: { memberIds: rows.map((row) => row.id) },
      });
      saveBlob(blob, `member-id-cards-${rows.length}.pdf`);
      toast.success(`Generated ${rows.length} card${rows.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(
        error instanceof TenantApiError ? error.message : "Could not generate the cards",
      );
    } finally {
      setBulkPrinting(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tenantApi(`/tenant/members/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Member deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function onChangeStatus() {
    if (!statusTarget) return;
    setChangingStatus(true);
    try {
      await tenantApi(`/tenant/members/${statusTarget.id}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      toast.success(`Member set to ${nextStatus.toLowerCase()}`);
      setStatusTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Status change failed");
    } finally {
      setChangingStatus(false);
    }
  }

  const columns: Column<MemberRow>[] = [
    {
      header: "ID Number",
      cell: (row) => <span className="font-mono text-xs">{row.memberIdNumber}</span>,
    },
    {
      header: "Member",
      cell: (row) => (
        <div>
          <span className="font-medium">{row.memberName}</span>
          {row.memberNameTamil && (
            <p className="text-xs text-muted-foreground">{row.memberNameTamil}</p>
          )}
        </div>
      ),
    },
    { header: "Business", cell: (row) => row.businessName },
    { header: "Position", cell: (row) => row.associationPosition?.positionName ?? "\u2014" },
    { header: "Taluk", cell: (row) => row.taluk?.talukName ?? "\u2014" },
    { header: "Phone", cell: (row) => row.phoneNumber },
    {
      header: "Aadhaar",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          XXXX XXXX {row.aadhaarLast4}
        </span>
      ),
    },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
  ];

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view members.
      </div>
    );
  }

  return (
    <>
      <ResourceTable<MemberRow>
        title="Members"
        description="The membership register. Search matches either script, the phone or the email."
        columns={columns}
        rows={list.rows}
        error={list.error}
        page={list.page}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        search={list.search}
        onSearchChange={list.setSearch}
        onSearchSubmit={list.applySearch}
        toolbarAction={
          <>
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(v) => {
                setStatusFilter(v === "ALL" ? "" : v);
                list.setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {SETTABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
                <SelectItem value="DELETED">Deleted</SelectItem>
              </SelectContent>
            </Select>
            {canGenerateCard && (
              <Button
                type="button"
                variant="outline"
                disabled={bulkPrinting || !list.rows || list.rows.length === 0}
                onClick={printVisibleCards}
                title="Generates a card for every member on this page, as one printable PDF"
              >
                {bulkPrinting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Printer className="size-4" />
                )}
                Print ID cards
              </Button>
            )}
            {canCreate && (
              <Button onClick={openCreate}>
                <UserPlus className="size-4" /> Enrol Member
              </Button>
            )}
          </>
        }
        renderActions={
          canUpdate || canDelete || canChangeStatus
            ? (row) => (
                <RowActionsMenu
                  actions={
                    [
                          ...(canUpdate
                            ? [{ label: "Edit", icon: Pencil, onClick: () => openEdit(row) }]
                            : []),
                          ...(canChangeStatus
                            ? [
                                {
                                  label: "Change status",
                                  icon: ShieldCheck,
                                  onClick: () => {
                                    setStatusTarget(row);
                                    setNextStatus(row.status === "DELETED" ? "PENDING" : row.status);
                                  },
                                },
                              ]
                            : []),
                          ...(canGenerateCard
                            ? [
                                {
                                  label:
                                    cardBusyId === row.id
                                      ? "Generating…"
                                      : "Generate ID card",
                                  icon: CreditCard,
                                  onClick: () => generateCard(row),
                                },
                              ]
                            : []),
                          ...(canDelete
                            ? [
                                {
                                  label: "Delete",
                                  icon: Trash2,
                                  onClick: () => setDeleteTarget(row),
                                  destructive: true,
                                },
                              ]
                            : []),
                        ]
                  }
                />
              )
            : undefined
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Member" : "Enrol Member"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Leave the Aadhaar field blank to keep the stored number."
                  : "A new member starts as pending until their status is changed."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              {/* Generated at enrolment, and not regenerated when the RTO
                  changes - so it is shown, never edited. */}
              {editing && (
                <div className="grid gap-2">
                  <Label>Membership Number</Label>
                  <Input value={editing.memberIdNumber} readOnly disabled />
                </div>
              )}

              {(businessOptions?.length ?? 0) > 1 && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label required>Business</Label>
                  <Combobox
                    options={businessOptions?.map((b) => ({ value: b.id, label: b.name })) ?? null}
                    value={form.tenantBusinessId}
                    onValueChange={onBusinessChange}
                    placeholder="Select a business"
                    searchPlaceholder="Search businesses..."
                    emptyText="No businesses found."
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label required htmlFor="memberName">Member Name</Label>
                <Input
                  id="memberName"
                  required
                  value={form.memberName}
                  onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="memberNameTamil">Member Name (Tamil)</Label>
                <Input
                  id="memberNameTamil"
                  value={form.memberNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, memberNameTamil: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  required
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="businessNameTamil">Business Name (Tamil)</Label>
                <Input
                  id="businessNameTamil"
                  value={form.businessNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, businessNameTamil: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required>Association Position</Label>
                <Combobox
                  options={positionOptions?.map((o) => ({ value: o.id, label: o.name })) ?? null}
                  value={form.associationPositionId}
                  onValueChange={(v) => setForm((f) => ({ ...f, associationPositionId: v }))}
                  placeholder={form.tenantBusinessId ? "Select a position" : "Select a business first"}
                  searchPlaceholder="Search positions..."
                  emptyText="No positions found."
                />
              </div>
              <div className="grid gap-2">
                <Label required>Industry</Label>
                <Combobox
                  options={industryOptions?.map((o) => ({ value: o.id, label: o.name })) ?? null}
                  value={form.industryId}
                  onValueChange={(v) => setForm((f) => ({ ...f, industryId: v }))}
                  placeholder={form.tenantBusinessId ? "Select an industry" : "Select a business first"}
                  searchPlaceholder="Search industries..."
                  emptyText="No industries found."
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label required={!editing} htmlFor="aadhaarNumber">
                  Aadhaar Number{editing ? " (leave blank to keep)" : ""}
                </Label>
                {editing && (
                  <p className="font-mono text-xs text-muted-foreground">
                    Stored: XXXX XXXX {editing.aadhaarLast4}
                  </p>
                )}
                <Input
                  id="aadhaarNumber"
                  inputMode="numeric"
                  required={!editing}
                  placeholder="12 digits"
                  value={form.aadhaarNumber}
                  onChange={(e) => setForm((f) => ({ ...f, aadhaarNumber: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Stored encrypted. Only the last four digits are ever shown.
                </p>
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="phoneNumber">Phone</Label>
                <Input
                  id="phoneNumber"
                  required
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="whatsappNumber">WhatsApp</Label>
                <Input
                  id="whatsappNumber"
                  value={form.whatsappNumber}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label required htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required>State</Label>
                <Combobox
                  options={stateOptions?.map((o) => ({ value: o.id, label: o.name })) ?? null}
                  value={form.stateId}
                  onValueChange={onStateChange}
                  placeholder={form.tenantBusinessId ? "Select a state" : "Select a business first"}
                  searchPlaceholder="Search states..."
                  emptyText="No states found."
                />
              </div>
              <div className="grid gap-2">
                <Label required>District</Label>
                <Combobox
                  options={districtOptions?.map((o) => ({ value: o.id, label: o.name })) ?? null}
                  value={form.districtId}
                  onValueChange={onDistrictChange}
                  placeholder={form.stateId ? "Select a district" : "Select a state first"}
                  searchPlaceholder="Search districts..."
                  emptyText="No districts found."
                />
              </div>
              <div className="grid gap-2">
                <Label required>Taluk</Label>
                <Combobox
                  options={talukOptions?.map((o) => ({ value: o.id, label: o.name })) ?? null}
                  value={form.talukId}
                  onValueChange={(v) => setForm((f) => ({ ...f, talukId: v }))}
                  placeholder={form.districtId ? "Select a taluk" : "Select a district first"}
                  searchPlaceholder="Search taluks..."
                  emptyText="No taluks found."
                />
              </div>
              <div className="grid gap-2">
                <Label required>RTO</Label>
                <Combobox
                  options={rtoOptions?.map((o) => ({ value: o.id, label: o.name })) ?? null}
                  value={form.rtoId}
                  onValueChange={(v) => setForm((f) => ({ ...f, rtoId: v }))}
                  // Narrowed by the DISTRICT, not the taluk above it.
                  placeholder={form.districtId ? "Select an RTO" : "Select a district first"}
                  searchPlaceholder="Search RTOs..."
                  emptyText="No RTOs found for this district."
                />
              </div>
              <div className="grid gap-2">
                <Label required htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label required htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  required
                  value={form.addressLine1}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={form.addressLine2}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="isMarried"
                  checked={form.isMarried}
                  onCheckedChange={(v) =>
                    // Clearing the flag clears the date with it, so the form
                    // cannot submit a contradiction.
                    setForm((f) => ({
                      ...f,
                      isMarried: v === true,
                      weddingDate: v === true ? f.weddingDate : "",
                    }))
                  }
                />
                <Label htmlFor="isMarried" className="font-normal">
                  Married
                </Label>
              </div>
              {form.isMarried && (
                <div className="grid gap-2">
                  <Label htmlFor="weddingDate">Wedding Date</Label>
                  <Input
                    id="weddingDate"
                    type="date"
                    value={form.weddingDate}
                    onChange={(e) => setForm((f) => ({ ...f, weddingDate: e.target.value }))}
                  />
                </div>
              )}

              <div className="grid gap-2 sm:col-span-2">
                <Label>Passport Photo</Label>
                <div className="flex items-center gap-3">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted">
                    {form.passportPhotoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={uploadUrl(form.passportPhotoPath)}
                        alt="Passport photo"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Upload className="size-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPhotoSelected}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {uploading && <LoaderCircle className="size-4 animate-spin" />}
                    {form.passportPhotoPath ? "Change photo" : "Upload photo"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="remark">Remark</Label>
                <Textarea
                  id="remark"
                  value={form.remark}
                  onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  !form.tenantBusinessId ||
                  !form.associationPositionId ||
                  !form.industryId ||
                  !form.stateId ||
                  !form.districtId ||
                  !form.talukId ||
                  !form.rtoId
                }
              >
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              {statusTarget?.memberName} is currently{" "}
              {statusTarget?.status.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label>New status</Label>
            <Select value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SETTABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusTarget(null)}
              disabled={changingStatus}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onChangeStatus} disabled={changingStatus}>
              {changingStatus && <LoaderCircle className="size-4 animate-spin" />}
              Change status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete member"
        description={`This will soft-delete "${deleteTarget?.memberName}". Their Aadhaar stays registered, so they cannot be enrolled again as a second record while this one is recoverable.`}
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}
