export interface Show {
  id: string;
  tmdb_id: number;
  title: string;
  poster_url: string;
  summary: string;
  friedrich_rating: number;
  rating: number;
  seasons: number;
  episodes: number;
  actors: string[];
  characters: string[];
  comment?: string;
  created_at?: string;
}

export interface Actor {
  id: string;
  actor_name: string;
  actor_img_url: string;
  ref_shows: string[]; // Array of show titles or tmdb_ids
}

export interface TMDBShow {
  id: number;
  name: string;
  poster_path: string;
  overview: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

export interface TMDBActor {
  id: number;
  name: string;
  profile_path: string;
  character: string;
}
