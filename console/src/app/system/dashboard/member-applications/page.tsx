"use client";

import * as React from "react";
import { CheckCircle2, Eye, LoaderCircle, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { ResourceTable, StatusBadgeText, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api";

interface ApplicationRow {
  id: string;
  systemCode: string;
  applicationNumber: string;
  memberName: string;
  memberNameTamil: string | null;
  businessName: string;
  businessNameTamil: string | null;
  aadhaarLast4: string | null;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  dateOfBirth: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DELETED";
  rejectionReason: string | null;
  /** Resolved by the server from reviewedBy, which may be a system
   *  user or a tenant one. Null when nobody has reviewed it yet, or
   *  when the reviewer's account has since been removed. */
  reviewedByName: string | null;
  reviewedAt: number | null;
  convertedMemberId: string | null;
  createdAt: number;
  tenantBusiness?: { id: string; name: string };
  associationPosition?: { positionName: string };
  industry?: { industryName: string };
  state?: { stateName: string };
  district?: { districtName: string };
  taluk?: { talukName: string };
  rto?: { rtoName: string; rtoCode: string };
}

export default function MemberApplicationsSystemPage() {
  const { hasPermission } = useSession();
  const canView = hasPermission("tenant-member-applications:list");
  const canApprove = hasPermission("tenant-member-applications:approve");
  const canReject = hasPermission("tenant-member-applications:reject");
  const canDelete = hasPermission("tenant-member-applications:delete");

  const [statusFilter, setStatusFilter] = React.useState("PENDING");
  const list = useResourceList<ApplicationRow>("/system/member-applications", {
    status: statusFilter || undefined,
  });

  const [viewing, setViewing] = React.useState<ApplicationRow | null>(null);
  const [approveTarget, setApproveTarget] = React.useState<ApplicationRow | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<ApplicationRow | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<ApplicationRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onApprove() {
    if (!approveTarget) return;
    setBusy(true);
    try {
      const member = await api<{ memberIdNumber: string }>(
        `/system/member-applications/${approveTarget.id}/approve`,
        { method: "PATCH" },
      );
      toast.success(`Approved. Membership number ${member.memberIdNumber}`);
      setApproveTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      await api(`/system/member-applications/${rejectTarget.id}/reject`, {
        method: "PATCH",
        body: { reason: rejectReason || undefined },
      });
      toast.success("Application rejected");
      setRejectTarget(null);
      setRejectReason("");
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Rejection failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/system/member-applications/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Application deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ApplicationRow>[] = [
    {
      header: "No.",
      cell: (row) => <span className="font-mono text-xs">{row.applicationNumber}</span>,
    },
    { header: "Business", cell: (row) => row.tenantBusiness?.name ?? "\u2014" },
    {
      header: "Applicant",
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
    { header: "Phone", cell: (row) => row.phoneNumber },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
    {
      header: "Reviewed by",
      cell: (row) =>
        row.reviewedByName ? (
          <span className="text-xs">
            {row.reviewedByName}
            {row.reviewedAt && (
              <span className="block text-muted-foreground">
                {new Date(row.reviewedAt * 1000).toLocaleDateString()}
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view membership applications.
      </div>
    );
  }

  return (
    <>
      <ResourceTable<ApplicationRow>
        title="Membership Applications"
        description="Membership applications across every tenant business."
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
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        }
        renderActions={(row) => (
          <RowActionsMenu
            actions={[
              { label: "View", icon: Eye, onClick: () => setViewing(row) },
              // Only a PENDING application can be decided: approving an
              // approved one would mint a second member, and the server
              // refuses it anyway.
              ...(canApprove && row.status === "PENDING"
                ? [{ label: "Approve", icon: CheckCircle2, onClick: () => setApproveTarget(row) }]
                : []),
              ...(canReject && row.status === "PENDING"
                ? [{ label: "Reject", icon: XCircle, onClick: () => setRejectTarget(row) }]
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
            ]}
          />
        )}
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application {viewing?.applicationNumber}</DialogTitle>
            <DialogDescription>
              Submitted {viewing ? new Date(viewing.createdAt * 1000).toLocaleDateString() : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="grid gap-x-4 gap-y-2 py-2 text-sm sm:grid-cols-2">
              {(
                [
                  ["Name", viewing.memberName],
                  ["Name (Tamil)", viewing.memberNameTamil],
                  ["Business", viewing.businessName],
                  ["Business (Tamil)", viewing.businessNameTamil],
                  ["Position", viewing.associationPosition?.positionName],
                  ["Trade", viewing.industry?.industryName],
                  ["Phone", viewing.phoneNumber],
                  ["Email", viewing.email],
                  ["Date of birth", viewing.dateOfBirth],
                  // The number itself is never returned, not even here.
                  ["Aadhaar", `•••• •••• ${viewing.aadhaarLast4}`],
                  ["Address", [viewing.addressLine1, viewing.addressLine2].filter(Boolean).join(", ")],
                  ["Taluk", viewing.taluk?.talukName],
                  ["District", viewing.district?.districtName],
                  ["State", viewing.state?.stateName],
                  ["RTO", viewing.rto ? `${viewing.rto.rtoCode} — ${viewing.rto.rtoName}` : null],
                  ["Rejection reason", viewing.rejectionReason],
                ] as [string, string | null | undefined][]
              ).map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title={`Approve ${approveTarget?.memberName ?? ""}?`}
        description="This creates the member, allocates their membership number from their RTO's sequence, and lets them sign in with the password they chose. It cannot be undone from here."
        confirmLabel="Approve and create member"
        loading={busy}
        onConfirm={onApprove}
      />

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.memberName}?</DialogTitle>
            <DialogDescription>
              The application is kept with its reason, so the same Aadhaar cannot
              simply be resubmitted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="rejectReason">Reason</Label>
            <Input
              id="rejectReason"
              maxLength={255}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onReject} disabled={busy}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete application"
        description={`This will soft-delete application ${deleteTarget?.applicationNumber ?? ""}.`}
        loading={busy}
        onConfirm={onDelete}
      />
    </>
  );
}
