# Feature: YouTube Video Links, Manual Sorting, and Topic Sharing

## Context and Current State
- The app has a `topics` table with basic fields: `id`, `subject_id`, `user_id`, `name`, `description`, `revision_count`, `last_revised_at`
- Topics are displayed in `SubjectPage.tsx` and can have PPTs uploaded via `TopicResourcesPage.tsx`
- Currently, topics are ordered by `created_at` descending
- There is no sharing functionality for topics

## Problem / Requirement
1. **YouTube Video Links**: Users should be able to add YouTube video URLs to topics so they can view videos related to the topic
2. **Manual Sorting**: Users should be able to manually reorder topics within a subject
3. **Sharing**: Users should be able to share topics (with PPTs and video URLs) with others via a shareable link

## Design Decisions

### Database Schema Changes
- Add `video_url TEXT` to `topics` table for storing YouTube video URLs
- Add `sort_order INTEGER` to `topics` table for manual ordering (defaults to position based on created_at)
- Add `share_token UUID` to `topics` table for generating unique share links
- Add `is_shared BOOLEAN DEFAULT false` to `topics` table to track if topic is shared

### YouTube Video Integration
- Validate YouTube URLs (support youtube.com and youtu.be formats)
- Extract video ID from URL for embedding
- Display video player in `TopicResourcesPage.tsx` when `video_url` exists
- Add video URL input field in topic creation/edit dialog

### Manual Sorting
- Implement drag-and-drop using `@dnd-kit/core` or simple up/down buttons
- Update `sort_order` when topics are reordered
- Order topics by `sort_order` ASC, then `created_at` DESC as fallback

### Sharing Functionality
- Generate unique `share_token` when user enables sharing
- Create shareable link format: `/shared/topic/:shareToken`
- Create `SharedTopicPage.tsx` to display shared topics (read-only)
- Allow viewing topic name, description, video, and PPTs (but not editing)
- Add share button in `SubjectPage.tsx` topic cards
- Copy share link to clipboard functionality

## Implementation Plan

1. **Database Migration**
   - Create migration file to add new columns to `topics` table
   - Set default `sort_order` based on existing `created_at` order
   - Generate `share_token` for existing topics (optional, can be NULL)

2. **Update TypeScript Types**
   - Update `Database` types to include new fields
   - Update `Topic` interface in components

3. **SubjectPage Updates**
   - Add video URL input to topic creation dialog
   - Add sorting UI (up/down buttons or drag-and-drop)
   - Add share button to topic cards
   - Update topic loading to order by `sort_order`

4. **TopicResourcesPage Updates**
   - Display YouTube video player when `video_url` exists
   - Show video section prominently

5. **Shared Topic View**
   - Create `SharedTopicPage.tsx` component
   - Fetch topic by `share_token`
   - Display topic info, video, and PPTs (read-only)
   - Add route in `App.tsx`

6. **Share Link Management**
   - Add function to generate/regenerate share token
   - Add copy to clipboard functionality
   - Add UI to enable/disable sharing

## Security Considerations
- Share tokens should be UUIDs (hard to guess)
- Shared topics should be read-only (no editing/deleting)
- RLS policies should allow reading topics by share_token (public read access)
- PPTs in shared topics should use signed URLs with expiration

