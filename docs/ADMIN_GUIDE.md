# Admin Guide

## AI-Powered Video Elements Content Platform — Administration Manual

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Content Upload](#content-upload)
4. [Moderation Queue](#moderation-queue)
5. [Content Library](#content-library)
6. [Analytics](#analytics)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Admin Dashboard

1. Log in with your Replit account
2. Navigate to `/admin` in your browser
3. You must have admin or moderator role to access dashboard features

### Role Hierarchy

| Role | Upload | Moderate | Analytics | Content Library | User Management |
|------|--------|----------|-----------|-----------------|------------------|
| User | ✅ (own) | ❌ | ❌ | ❌ | ❌ |
| Moderator | ✅ | ✅ | ❌ | ✅ (view) | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ (full) | ✅ |

---

## Dashboard Overview

The admin dashboard has four main sections accessible from the sidebar:

- **Upload**: Upload new video content with AI categorization
- **Queue**: Review flagged content awaiting moderation
- **Content**: Browse and manage all published content
- **Analytics**: View platform metrics and trends

---

## Content Upload

### Uploading Videos

1. Click **Upload** in the sidebar
2. Select a video file (supported: MP4, MOV, WebM, AVI; max 100MB)
3. Fill in the title and description
4. Select an element category (Water, Fire, Earth, Air, Spiritual)
5. Click **Upload Video**

### Upload Pipeline

After upload, content goes through this automated pipeline:

```
Upload → AI Analysis (element categorization)
       → Safety Check (OpenAI moderation)
       → Positivity Scoring (0-100)
       → Auto-Approve or Flag for Review
```

**Processing time**: Typically 10-30 seconds. Maximum 2 minutes before timeout.

### Upload Statuses

| Status | Meaning |
|--------|----------|
| Under Review | Content is being analyzed by AI |
| Published | Content passed all checks and is live |
| Rejected | Content was rejected by moderator |
| Failed | Analysis failed (retry or manual review needed) |

### Category Override

After AI analysis, the admin upload form displays the suggested category. You can override this suggestion before publishing.

---

## Moderation Queue

### Queue Overview

The moderation queue shows all content flagged by the AI safety system. Items are sorted by priority:

| Priority | Color | Meaning |
|----------|-------|----------|
| 🔴 Urgent | Red | High-risk safety flags (violence, hate) |
| 🟣 High | Purple | Medium-risk concerns (suggestive content) |
| 🔵 Normal | Blue | Minor flags (mild language) |
| ⚪ Low | Gray | Borderline content, low concern |

### Reviewing Content

1. Navigate to **Queue** in the sidebar
2. Each item shows:
   - Priority badge
   - Content type (video/post)
   - AI flagged reason
   - Positivity score
   - Timestamp
3. Click "Add notes" to expand the notes field
4. Click **Approve** (green) or **Reject** (red)

### Keyboard Shortcuts

When a moderation item is focused (click to focus):

| Key | Action |
|-----|--------|
| `Space` | Approve content |
| `D` | Reject content |

**Note**: Shortcuts are disabled when typing in the notes field.

### Audit Trail

Every moderation decision is automatically logged with:
- Decision (approved/rejected)
- Moderator ID
- Timestamp
- Notes (if provided)
- Previous status

---

## Content Library

### Browsing Content

The Content Library shows all published content with filters:

- **Element filter**: Show only Water, Fire, Earth, Air, or Spiritual
- **Status filter**: Published, Under Review, Rejected
- **Search**: Full-text search on titles and content

### Managing Content

- **View**: Click on any content item to see full details
- **Edit metadata**: Update title, description, or category
- **Remove**: Soft-delete content (can be restored)

---

## Analytics

### Overview Metrics

The analytics dashboard displays:

- **Total Content**: Combined videos and posts
- **Approval Rate**: Percentage of content auto-approved
- **Safety Flag Rate**: Percentage flagged by AI
- **Element Distribution**: Content count per element

### Charts Available

1. **Element Distribution**: Pie/bar chart of content per element
2. **Top Content**: Highest-performing videos and posts
3. **Safety Metrics**: Flags vs approvals over time
4. **Positivity Trends**: Average positivity scores over time

---

## Troubleshooting

### Common Issues

#### Content stuck in "Under Review"
- AI analysis may have timed out (2-minute limit)
- Check if OpenAI API key is valid and has credits
- Manually approve or reject from the moderation queue

#### Upload fails immediately
- Check file size (must be ≤ 100MB)
- Verify file format (MP4, MOV, WebM, AVI only)
- Check browser console for network errors

#### Positivity score shows as N/A
- Score calculation requires OpenAI API
- If API is unavailable, fallback keyword analysis is used
- Re-trigger analysis from the content library

#### Dashboard shows no data
- Verify you have admin/moderator role
- Check database connection (DATABASE_URL)
- Ensure at least one content item exists

### Getting Help

- Check the [API Documentation](./API.md) for technical details
- Review the [Runbook](./RUNBOOK.md) for operational procedures
- Check the [Deployment Guide](./DEPLOYMENT.md) for setup issues
