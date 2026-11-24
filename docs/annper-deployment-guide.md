# annper Deployment Guide

**Date:** 2026-11-24\
**Author:** Mark Ray-Smith — Cityline Ltd\
**Status:** Working guide\
**Scope:** Authoring, approval, and publication of application configurations

This guide summarizes the controlled documents listed in [document
control](annper-document-control.md). Those documents govern if wording differs.

## 1. Summary

- Deploying means **publishing a version of one application's configuration**. annper Studio and annper Workspace are two front ends of one platform, so nothing is copied from one to the other. annper Workspace always applies the version of each application that is currently published.
- An application configuration is self-contained. Its **application roles** and **application users** are part of it and are deployed with it. Nothing is shared between applications.
- A change to roles or users is made in the application's draft. It has no effect in annper Workspace until that draft is validated, approved, and published.
- Who may carry out each step in annper Studio is decided by **Studio roles**, which have nothing to do with any application.

## 2. Terms

| Term | Meaning |
|---|---|
| Application configuration | Everything that defines one business application: its properties, navigation, screens, DataClasses, connections, value lists, reports, application roles, and application users |
| Application role | A named set of permissions on that application's screens, commands, and fields |
| Application user | A person allowed to use that application. The entry holds the person's identity-provider subject, whether they are active, the application roles they hold, whether this application opens first for them, and any per-screen overrides. It holds no password |
| Draft | The editable version of an application configuration |
| Candidate | A validated draft with a fixed digest, waiting for approval |
| Published version | The version annper Workspace applies. Each application has exactly one at a time |
| Studio user, Studio role | A person who works in annper Studio, and the fixed platform role that says what they may do there |

## 3. Who does what in annper Studio

| Studio role | Part in a deployment |
|---|---|
| Platform administrator | Appoints Studio users by granting Studio roles. Each grant needs the approval of a second platform administrator |
| Configurator | Creates the application. Edits everything in the draft except connections, roles, and users. Validates, publishes, rolls back, and retires |
| Database owner | Edits the draft's connections |
| Security administrator | Edits the draft's application roles and application users |
| Approver | Approves the candidate. An approver cannot approve a draft they edited |

The reference prototype asks for three approvals: Product, Security, and Test. The formal approval model is still an open decision (section 12).

## 4. Before the first deployment: platform prerequisites

These are done once for each environment.

Outside annper Studio, by a controlled deployment change:

1. Deploy the platform, with its platform store on a qualified database engine, and register it with the organization's identity provider.
2. Name the bootstrap platform administrators in deployment configuration, by identity-provider subject. Name at least two. Name three if a platform administrator is also to hold another Studio role, because a grant needs an approver who is neither the proposer nor the recipient.

In annper Studio:

3. The platform administrators sign in and grant the Studio roles the work needs: a configurator, a security administrator, a database owner, and approvers. Appoint enough approvers that every approval can be given by someone who did not edit the draft.

## 5. First deployment of an application

| Step | Who | What they do | Result |
|---:|---|---|---|
| 1 | Configurator | Creates the application configuration | A first draft exists. Nothing is published, so nobody can start the application in annper Workspace |
| 2 | Configurator | Builds the application: properties, navigation, screens, DataClasses, value lists, reports | The draft describes the application |
| 3 | Database owner | Registers each connection: a logical ID, a provider from the registered catalogue, and a secret reference | The draft names its connections. It holds no endpoint and no secret value |
| 4 | Operations (outside annper Studio) | Maps each logical connection to its endpoint, pool, and secret in deployment configuration | The connections can be resolved in this environment |
| 5 | Security administrator | Creates the application roles and sets what each may do on each screen, with any field policies and row scopes | The draft says what each role permits |
| 6 | Security administrator | Adds each application user: identity-provider subject, name, active state, the roles held, and whether this application opens first for that person | The draft says who may use the application |
| 7 | Configurator | Runs validation | Errors block the candidate. A warning must be accepted under an approved rule |
| 8 | Approvers | Each approves the exact candidate | Any later edit cancels every approval |
| 9 | Configurator | Publishes, at once or at a scheduled time | The version is Published. annper Workspace applies it |

What validation checks about access:

- Every application role names only screens of this application.
- Every role held by a user, and every screen named in a user's override, belongs to this application.
- No identity-provider subject appears twice in the application's user list.
- Nothing refers to another application's screen, DataClass, connection, value list, report, role, or user.
- An active user who holds no role is reported as a warning, because that person could not start the application.

After step 9, a person can start the application when three things are true in the published version: they are on its user list, their entry is active, and they hold at least one of its active roles. They sign in through the organization's identity provider; the platform never holds their password.

## 6. Subsequent deployments

Publishing opens the next draft automatically, based on the version just published.

| Step | Who | What they do |
|---:|---|---|
| 1 | Whoever owns the part that changes | Edits the draft: the configurator for screens and the rest, the database owner for connections, the security administrator for application roles and application users |
| 2 | Configurator | Runs validation |
| 3 | Approvers | Approve the candidate |
| 4 | Configurator | Publishes, at once or at a scheduled time |

Until step 4, annper Workspace keeps applying the previous version. In annper Studio the Application users page shows both states side by side: whether a person can start in the version being edited, and whether they can start today under the published version.

Each application is deployed on its own. Publishing Operations Hub changes nothing in Risk & Controls.

## 7. What happens in annper Workspace when a version is published

- The switch is complete or it does not happen. People see either the previous version or the new one, never a mixture.
- Access is rechecked on every request against the newly published version. A newly added user can start at once. A user who was removed or made inactive is refused on their next request.
- Someone working in the application is told that a new version is active. Screens they open afterwards use the new version. A screen with unsaved work stays on its version while the two versions are compatible, and otherwise asks them to save, discard, or check the work again.
- Someone with unsaved work who has just lost access is given a notice and the unsaved work is discarded.

## 8. Common access changes

| Change | Where to make it | When it takes effect |
|---|---|---|
| Add a person to an application | That application's draft: add an application user and give them a role | When that application is next published |
| A person leaves or should lose access | That application's draft: make the user inactive, or remove them | When published. If it cannot wait, follow section 9 as well |
| Change which roles a person holds | That application's draft: edit the user's roles | When published |
| Change what a role permits | That application's draft: edit the application role | When published. It applies to everyone who holds the role |
| Give one person different access on one screen | That application's draft: add an override to the user, with a reason | When published |
| A person needs a second application | The second application's draft: add them there as a separate user | When the second application is published |
| Appoint someone to work in annper Studio | Studio users: propose a Studio role for them | When a second platform administrator approves. No publication is involved |

## 9. Removing access urgently

A publication takes time. When access must stop now:

1. Disable the person at the organization's identity provider. They can no longer sign in.
2. End their sessions. This takes effect on their next request.
3. Then remove them, or make them inactive, in the draft of every application that lists them, and publish each one.

Steps 1 and 2 stop the access. Step 3 makes the configuration say so.

## 10. Rollback, withdrawal, and retirement

- **Rollback** reactivates the previous version of that application and marks the failed one Withdrawn. It is a single action by the configurator and needs a reason.
- **Rollback restores access as well.** Roles and users are part of the version, so the previous user list comes back with everything else. A person removed in the withdrawn version can start the application again, and a person added in it cannot. Publish the access change again once the fault is fixed, and use section 9 in the meantime if someone must stay out.
- **A withdrawn version cannot run.** New work is refused under it. Work already accepted completes and reports its real outcome. To use its content again, copy it into a new draft and take that through validation and approval.
- **Retirement** closes a version that is no longer needed. It cannot be reactivated.

## 11. Checklist before publishing

- Validation shows no errors, and every warning is accepted for a stated reason.
- Every approval was given by someone who did not edit this draft.
- The comparison with the published version shows only the intended changes, including changes to roles and users.
- Everyone who must be able to start the application has an active entry with at least one role.
- Everyone who must not be able to start it is inactive or absent.
- Each connection in the draft has its deployment mapping in this environment.
- If the publication is scheduled, the time is one when a change of version is acceptable to the people using the application.

## 12. Open decisions that affect deployment

| Decision | Question | Effect until it is decided |
|---|---|---|
| D-024 | How does an application configuration move from one environment to another, for example from test to production? In particular, is the application user list specific to each environment, or does it move with the rest of the configuration? | This guide and the design describe publication within one environment only |
| D-015 | Which approvals does a publication need, and who may give them? | The reference prototype's three approvals are a candidate, not a rule |

## 13. Where each rule is defined

| Topic | Controlled document and section |
|---|---|
| Versions, publication, rollback, withdrawal, retirement | [Modern web system design](../docs/annper-modern-web-system-design.md), section 11.2 |
| Validation and compilation | Design, section 11.3 |
| Approval bound to the candidate, and who may author | Design, section 11.4 |
| The application configuration as the unit of deployment | Design, section 11.7 |
| Application roles and application users | Design, section 15.6 |
| Studio roles, Studio users, and the grant rules | Design, section 15.7 |
| Connections and their deployment mapping | Design, sections 14.3 and 27.3 |
| Effect on open screens and sessions | Design, sections 7.4, 11.2, 11.5, and 15.2 |
| Publication sequence | Design, Appendix A.3 |
| Start-up, default application, overrides, last login | [Functional specification](../docs/annper-functional-specification.md), section 8 (FR-SEC-002 to FR-SEC-009) |
| Decisions and their records | [Decision register](annper-migration-master.md#7-decision-register) and [architecture decision records](annper-architecture-decisions.md) (ADR-007, ADR-008) |

The [annper Studio prototype](../prototype/annper-admin-mockup.html) shows every step of sections 5, 6, and 10 with sample data.
