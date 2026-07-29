export interface Show {
  id: string;
  tmdb_id: number;
  title: string;
  poster_url: string;
  summary: string;
  seasons: number;
  episodes: number;
  actors: string[];
  characters: string[];
  episode_runtime?: number;
  release_year?: number | null;
}

export interface Actor {
  id: string;
  actor_name: string;
  actor_img_url: string;
  ref_shows: string[]; // Array of show titles or tmdb_ids
}

export type ShowStatus = 'watched' | 'watching' | 'want_to_watch';

export interface UserShow {
  id: string;
  user_id: string;
  show_id: string;
  user_rating: number;
  comments: string;
  status: ShowStatus;
  added_at: string;
  is_spoiler: boolean;
  // Joined data
  show?: Show;
  likes_count?: number;
  is_liked?: boolean;
  awards?: Award[];
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
  allow_comments: boolean;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  // Joined data
  friend_profile?: Profile;
  user_profile?: Profile;
}

export interface CommentLike {
  id: string;
  user_id: string;
  comment_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  user_show_id: string;
  parent_id: string | null;
  body: string;
  is_spoiler: boolean;
  created_at: string;
  // Joined data
  Profiles?: Profile;
  replies_count?: number;
  likes_count?: number;
  is_liked?: boolean;
}

export type AwardType = 
  | 'Best Lead Chemistry'
  | 'Best Lead Actress'
  | 'Best Lead Actor'
  | 'Best Soundtrack'
  | 'Made Me Cry the Most'
  | 'Funniest Show'
  | 'Most Addictive'
  | 'Best Slow Burn'
  | 'Best Supporting Roles'
  | 'Best Village'
  | 'Best Historical'
  | 'Best Cinematic'
  | 'Most Creative'
  | 'Most Wholesome';

export interface Award {
  id: string;
  user_id: string;
  show_id: string;
  award: AwardType;
  created_at: string;
  // Joined data
  Show_data?: Show;
}

export interface InviteLink {
  id: string;
  user_id: string;
  code: string;
  uses: number;
  created_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  // Joined data
  Profiles?: Profile;
  shows_count?: number;
  follows_count?: number;
  is_followed?: boolean;
}

export interface PlaylistShow {
  id: string;
  playlist_id: string;
  show_id: string;
  position: number;
  created_at: string;
  // Joined data
  Show_data?: Show;
}

export interface PlaylistFollow {
  id: string;
  user_id: string;
  playlist_id: string;
  created_at: string;
}

export interface TMDBShow {
  id: number;
  name: string;
  poster_path: string;
  overview: string;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

export interface TMDBActor {
  id: number;
  name: string;
  profile_path: string;
  character: string;
}

export type FeedEventType = 
  | 'added_show' | 'status_changed' | 'commented' | 'rated' | 'liked_comment'
  | 'gave_award' | 'created_playlist' | 'followed_playlist';

export interface FeedEvent {
  id: string;
  user_id: string;
  event_type: FeedEventType;
  show_id?: string;
  user_show_id?: string;
  metadata: any;
  created_at: string;
  // Joined data
  Profiles?: Profile;
  Show_data?: Show;
}
