---
layout: page
title: Install OCS-in-a-Kit
description: Set up your own copy of this site and its backends for your school or organization.
permalink: /install/
search_exclude: false
---

This site is part of **OCS-in-a-Kit**: a website plus two backend servers (Flask and Spring) that
any school or organization can run. One installer sets everything up.

## Pick a kit

| Kit | For | Roles |
|---|---|---|
| **Vanilla** | A simple site you can hand to a student | Admin, Editor, User |
| **Education** | A CS classroom: lessons, code runners, assignments, AI tutor, hall pass | Admin, Teacher, Student |
| **Business** | An organization serving its own users | Admin, Manager, Member |

Your choice is not final. Admins can switch to another kit or turn single features on and off at any time from **Admin → Manage features**, with no website rebuild. Accounts and data are kept; turned-off features are hidden, not deleted.

## Install

You need Python 3.8+, Git and Docker. Run the installer as your normal user (not `sudo`):

```bash
git clone https://github.com/CSA-Admin-OCS/OCS-Kit.git
cd OCS-Kit
./install.sh        # macOS and Linux
install.bat         # Windows
```

A page opens in your browser and asks for your kit, school name, passwords and any API keys,
then downloads, configures and starts everything. When it finishes, log in as `admin` and open
**Admin → Manage features** to finish setting up each feature with its setup guide.

The full guide covers requirements per operating system, going live on your own domain with
HTTPS, updates, backups and troubleshooting:
[docs/INSTALL.md](https://github.com/CSA-Admin-OCS/OCS-Kit/blob/main/docs/INSTALL.md).
