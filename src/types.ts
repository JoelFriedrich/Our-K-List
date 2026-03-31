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
  // Joined data
  show?: Show;
  likes_count?: number;
  is_liked?: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
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
  user_show_id: string;
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
