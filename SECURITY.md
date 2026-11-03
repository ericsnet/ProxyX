# Security policy

Do not publish a public, unauthenticated proxy endpoint.

Report suspected vulnerabilities privately to the repository owner through GitHub's security advisory feature where available. Include affected component, reproduction conditions and impact. Do not include real credentials or other people's data.

Known early-development limitations:
- The local proxy has no user authentication and is therefore hard-restricted to loopback addresses.
- The local CONNECT path currently opens the requested authority directly. This is appropriate only for a proxy used locally by its owner; destination policy and DNS/IP filtering are required before considering broader deployment.
- The Worker checks literal IP addresses and host allowlists, but hostname resolution and DNS rebinding require further defense-in-depth.
- The local implementation buffers HTTP bodies and is not optimized for large transfers.
