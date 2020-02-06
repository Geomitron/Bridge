export interface SongSearch {
  query: string
  type: SearchType
}

export enum SearchType {
  'Any', 'Name', 'Artist', 'Album', 'Genre', 'Year', 'Charter'
}

export interface SongResult {
  id: number
  name: string
  artist: string
  album: string
  genre: string
  year: string
}