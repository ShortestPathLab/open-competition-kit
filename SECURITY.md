# Security

## Reporting a vulnerability

Email <askus@kmt.global>, or open a private security advisory through the
repository's Security tab. Please do not open a public issue for a vulnerability.

Tell us what you found, how to reproduce it, and what an attacker gets out of it.
We will confirm we have it, and tell you what we intend to do about it and roughly
when.

## What this software is exposed to

Open Competition Kit runs untrusted code by design. A submission is somebody
else's program and the whole point is to execute it, so the interesting questions
are about what that program can reach.

**Where evaluations run is a choice you make, and the default is not confinement.**
With no machine package installed, `machine-local` runs each submission as a child
process of the runner service, with the same filesystem, network and credentials
that service has, and no memory or process limit. It says so in the log every time
it starts. That is reasonable while you are the only one submitting, and it is not
reasonable the moment anyone else can. Install
`@open-competition-kit/machine-docker` before you open a competition, and set the
limits it offers.

**Secrets in the config file are secrets on disk.** `secrets:` holds tokens the
kit hands to packages. Use `${{ env("NAME") }}` and keep the values in the
environment rather than writing them into a file that ends up in a repository.

**The organiser dashboard is guarded by an email list.** `admins:` names who can
reach it. An empty or absent list means nobody, which is the intended failure
mode. Every server function behind the dashboard checks for itself rather than
relying on the routes, because a server function is a public HTTP endpoint whoever
is calling it.

**Configuration editing writes to your config file and can restart the service.**
Anyone on the `admins:` list can change how the competition behaves. Treat that
list the way you would treat shell access to the host.

## Versions

Fixes go onto the latest release. There are no maintained older branches.
