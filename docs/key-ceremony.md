Perfect — this is the ceremony, and you run every command on the admin's local machine.

⚠️ Do not paste the master key, the clinic-recovery.key contents, or master-key.age back to me or into any chat/email. If one ever lands in a transcript, treat it as compromised and start over with a fresh key. I'm not running these for you by design.

Commands below are for Git Bash (you have it). First make sure age is installed:


age --version || winget install FiloSottile.age    # or: scoop install age
Step 1 — recovery keypair

age-keygen -o clinic-recovery.key
Prints Public key: age1… to the screen and writes the private key to clinic-recovery.key.

Step 2 — the master key

MASTER_KEY=$(openssl rand -hex 32)     # 64 hex chars; this is THE key
echo "$MASTER_KEY"                     # note it down privately — you need it in the seed + unlock steps
"First key wins": whatever you seed Corona with becomes the permanent canary. This exact value goes into ENCRYPTION_KEY=… at the seed --minimal step and into the unlock banner after every restart.

Step 3 — escrow the master key (wrap it to the public key)

printf '%s' "$MASTER_KEY" | age -r "age1…" > master-key.age
(printf '%s' avoids a trailing newline that would corrupt the recovered key.) master-key.age is useless without the private key, so it can live anywhere — even with us.

Step 4 — verify the round-trip before trusting it

age -d -i clinic-recovery.key master-key.age    # must print the same 64 chars as Step 2
Compare it yourself to Step 2's value — don't send it to me.

Step 5 — escrow the two artifacts
clinic-recovery.key (the break-glass private key) → print it, seal it, store in two separate physical locations (safe + owner). Never on the VPS.
master-key.age → store alongside (and it's safe to keep a copy anywhere, including with the vendor).
Step 6 — set the public key in Coolify
On the corona-dental app resource, add env var:


BACKUP_AGE_PUBKEY = age1…      (the public key from Step 1 — not secret)
Optional right now (backups run local-only until set): HEALTHCHECK_URL, STORAGEBOX_*.

When Steps 1–6 are done and the round-trip in Step 4 matched, tell me "ceremony done, round-trip matched" (not the values) and we move to Deploy → seed --minimal, where you'll use ENCRYPTION_KEY=$MASTER_KEY.

