/**
 * Spotify Infrastructure - Internal API Response Types
 * Strongly typed shapes for Spotify Web API endpoints.
 * These types remain strictly inside the infrastructure layer.
 */

import { z } from 'zod';

export const SpotifyImageSchema = z.object({
  url: z.string().url(),
  height: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
});
export type SpotifyImage = z.infer<typeof SpotifyImageSchema>;

export const SpotifyArtistObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string().optional(),
});
export type SpotifyArtistObject = z.infer<typeof SpotifyArtistObjectSchema>;

export const SpotifyAlbumObjectSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  release_date: z.string().optional(),
  total_tracks: z.number().int().optional(),
  images: z.array(SpotifyImageSchema).optional(),
  artists: z.array(SpotifyArtistObjectSchema).optional(),
  uri: z.string().optional(),
});
export type SpotifyAlbumObject = z.infer<typeof SpotifyAlbumObjectSchema>;

export const SpotifyExternalIdsSchema = z.object({
  isrc: z.string().optional(),
  ean: z.string().optional(),
  upc: z.string().optional(),
});
export type SpotifyExternalIds = z.infer<typeof SpotifyExternalIdsSchema>;

export const SpotifyTrackObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(SpotifyArtistObjectSchema).default([]),
  album: SpotifyAlbumObjectSchema.optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  explicit: z.boolean().optional(),
  track_number: z.number().int().positive().optional(),
  disc_number: z.number().int().positive().optional(),
  is_playable: z.boolean().optional(),
  popularity: z.number().int().optional(),
  uri: z.string().optional(),
  external_ids: SpotifyExternalIdsSchema.optional(),
});
export type SpotifyTrackObject = z.infer<typeof SpotifyTrackObjectSchema>;

export const SpotifyPlaylistTrackItemSchema = z.object({
  added_at: z.string().optional(),
  is_local: z.boolean().optional(),
  track: SpotifyTrackObjectSchema.nullable().optional(),
});
export type SpotifyPlaylistTrackItem = z.infer<typeof SpotifyPlaylistTrackItemSchema>;

export const SpotifyPlaylistTracksResponseSchema = z.object({
  href: z.string().optional(),
  items: z.array(SpotifyPlaylistTrackItemSchema).default([]),
  limit: z.number().int().optional(),
  next: z.string().nullable().optional(),
  offset: z.number().int().optional(),
  previous: z.string().nullable().optional(),
  total: z.number().int().default(0),
});
export type SpotifyPlaylistTracksResponse = z.infer<typeof SpotifyPlaylistTracksResponseSchema>;

export const SpotifyOwnerSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  uri: z.string().optional(),
});
export type SpotifyOwner = z.infer<typeof SpotifyOwnerSchema>;

export const SpotifyPlaylistObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner: SpotifyOwnerSchema.optional(),
  images: z.array(SpotifyImageSchema).optional(),
  tracks: z.object({
    total: z.number().int().default(0),
    href: z.string().optional(),
  }).optional(),
  uri: z.string().optional(),
  snapshot_id: z.string().optional(),
});
export type SpotifyPlaylistObject = z.infer<typeof SpotifyPlaylistObjectSchema>;
