// src/types.ts

export interface Video {
  muxPlaybackId: string;
  title: string;
  duration: string;
}

export interface Section {
  title: string;
  videos: Video[];
}

export interface Course {
  sections: Section[];
  // Add other course properties if needed
}