# The member portal

Members were data in a staff-managed register. This gives them a way in: a
public page on the association's own domain, a registration form, and a portal
where they sign in and see their own record.

It makes members a **third authentication surface**, alongside system users and
tenant users.

## The rule this designs against

`CLAUDE.md` is blunt: *"`POST /system/register` was deleted: it was
`@Public()`, granted `SUPER_ADMIN` to the first caller, and never closed. Do
not add an unauthenticated account-creation route."*

That rule is about **staff** accounts, and this adds none. But it is the right
warning, so public registration here:

- writes to `tenant_member_applications`, **never `tenant_members`**
- is refused unless that business has `memberRegister.enabled` on
- takes its business from the **hostname**, never the request body
- creates no permission, no role and no session
- is throttled at 5/minute, like every other credential endpoint

**An application grants nothing.** No membership number, no portal access, and
no row anything joins to — until staff approve it.

## The front door depends on the hostname

`/` still resolves by hostname, as it always did. What changed is what a
**tenant domain** does: instead of bouncing to `/tenant/login`, it renders the
association's own home page — name in both scripts, logo, tagline, contact
details, and **Member login** / **Apply for membership** buttons.

On a tenant's own domain the public are members and prospective members, not
administrators. Staff reach `/tenant/login` from the quiet link at the bottom,
or by typing it. The system console is untouched.

Only the database knows which hostnames are business domains, so the page asks
the API rather than reading the `Host` header — doing that would duplicate the
domain list into `console/.env`, a second source of truth for something the
admin UI edits at run time.

## Public endpoints

In `backend/src/site/`, which already owns `@Public()` + `@SkipApiKey()`
routes:

| Route | Purpose |
| --- | --- |
| `GET public/member/site` | The association's public details |
| `GET public/member/options` | The lookups the form's pickers need |
| `POST public/member/apply` | File an application |

**The business always comes from the `Host` header.** On the system console
there is no association, so all three return **404** — the member portal simply
does not exist on that hostname. A body-supplied business id would let anyone
file against any association, which is why there is no such field.

`site` returns an **allow-listed** subset of the Association settings, not the
whole map: the settings store also holds things a business did not publish, and
a list is the only version of this that stays correct when a setting is added
later.

`options` returns positions, industries and the geography chain, ACTIVE only.
Reference data — it already prints on every membership card. Districts, taluks
and RTOs come back **with their parent id**, so the form cascades in the
browser instead of asking again on every change.

## Applications

`tenant_member_applications` mirrors every field of `tenant_members`, so the
applicant supplies their details once and approval is a copy rather than a
second interview. What it does **not** carry is `memberIdNumber` — that is
allocated at conversion by the register's own allocator.

The **Aadhaar gets the same three columns** as the register: ciphertext, a
keyed blind index, and the last four in the clear. A pending application holds
the same number as a member and gets the same protection, and the blind index
catches somebody applying twice. It is checked against **both tables** on
submission, so an existing member is told to sign in rather than left waiting
on an application that would be rejected as a duplicate.

### `applicationNumber`

Zero-padded digits from `000001`, per business — two associations can both have
application `000001`, which is what each would expect.

Allocated exactly as [membership numbers](./members.md#the-membership-number)
are, and for the same two reasons:

1. **The business row is locked** with `SELECT … FOR UPDATE`. There is no row
   to lock for a number that does not exist yet, so locking the applications
   would not stop two submissions both reading `000001`.
2. **The suffix is compared numerically.** Once the sequence outgrows the
   padding, a string max stops advancing and every insert collides forever.

### Approval converts

One transaction: the member is created, `memberIdNumber` is allocated from the
RTO's sequence, the **password hash is carried across unchanged** so the
applicant signs in with what they chose, and the application records
`convertedMemberId`.

The hash is moved rather than re-derived — re-hashing would invalidate their
password, and the Aadhaar cannot be re-encrypted without plaintext, which is
the point of storing it encrypted.

The member is created **`ACTIVE`, not `PENDING`** — a deliberate break from "a
new member starts PENDING", because this approval *is* that review. Leaving
them PENDING would mean they still could not sign in after being accepted.

Rejecting **keeps the row**, with its reason, so the blind index keeps catching
a resubmission. Reopening one is a staff decision, not something an applicant
can force by filling the form again.

## Member authentication

`backend/src/member-auth/` mirrors `tenant-auth/`: login, refresh, logout, me,
a `MemberJwtStrategy`, and `tenant_member_refresh_tokens` storing only a
SHA-256 **hash** of the refresh JWT. The portal shows somebody their own
address and the last four digits of their Aadhaar, so it gets the same session
handling as the staff portals rather than a weaker one.

**Login is the membership number plus a password**, scoped to the hostname's
business — `TN72001` is unique per business, not globally, so the host is part
of the lookup rather than an afterthought. Email was rejected as the identity
because it would need a unique index that two members sharing a family address
would fail.

Login is refused unless the member is `ACTIVE` **and** has a `passwordHash`.
`passwordHash` is nullable on purpose: every member enrolled by staff has none
and must not be forced one.

Two ordering details that are deliberate:

- The password is verified **even when no member matched**, against a throwaway
  hash, so a wrong number and a wrong password cost the same time.
- The status check comes **after** the password check, so a membership's status
  is not discoverable by guessing numbers.

Refresh tokens are **rotated**: the presented one is revoked as the new pair is
issued, so a stolen token is good for a single use and its reuse is detectable.
Changing a password ends every other session, because that is how somebody
locks out whoever they think is using their account.

### There is no permissions guard

A member holds no RBAC role, so there is nothing to look up and no
`MemberPermissionsGuard` to pair with the JWT one. **Authorisation is
structural instead:** every portal endpoint reads the member out of the token,
and no route takes a member id — so there is no "read another member" route to
get wrong.

The strategy re-reads the member on every request rather than trusting the
token, so somebody suspended a minute ago stops being able to read their record
now, not when their access token happens to expire.

Routes carry `@Public()` — which skips only the **system** JWT guard — and
still require the API key. Those are the two separate axes `CLAUDE.md` warns
about confusing.

## Permissions

`tenant-member-applications`: `list, view, approve, reject, delete`.

**No `create`**, because the only way an application exists is the public form,
so there is no staff route to grant.
