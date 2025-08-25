import React, { useState, useMemo } from 'react'
import type { Course, Section, Video } from '../types'
import { Button } from '@/components/ui/button'

interface CoursePlayerProps {
  course: Course
  currentVideoId: string
  onSelect: (videoId: string) => void
}

const CoursePlayer: React.FC<CoursePlayerProps> = ({ course, currentVideoId, onSelect }) => {
  // State for live search query
  const [query, setQuery] = useState('')

  // Filter sections and videos based on the query, memoized for performance
  const filteredSections = useMemo(() => {
    return course.sections
      .map((section: Section) => ({
        ...section,
        videos: section.videos.filter((video: Video) =>
          video.title.toLowerCase().includes(query.toLowerCase())
        ),
      }))
      .filter((section: Section) => section.videos.length > 0)
  }, [course.sections, query])

  // Track which sections are expanded or collapsed
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(
      course.sections.map((s: Section) => [s.title, true])
    )
  )

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <aside className="hidden md:block sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto w-full md:w-1/4 p-4 bg-white shadow rounded">
      {/* Search input */}
      <input
        type="text"
        placeholder="Search videos..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      />

      {/* Accordion sections */}
      {filteredSections.map((section: Section) => (
        <div key={section.title} className="mb-3">
          <Button variant="default" size="default"
            onClick={() => toggleSection(section.title)}
          >
            <span>{section.title}</span>
            <span>{openSections[section.title] ? '−' : '+'}</span>
          </Button>

          {/* Video list within expanded section */}
          {openSections[section.title] && (
            <ul className="mt-2 space-y-1">
              {section.videos.map((video: Video) => (
                <li key={video.muxPlaybackId}>
                  <Button
                    variant="default" size="default"
                    onClick={() => onSelect(video.muxPlaybackId)}
                    className={`block w-full text-left p-2 rounded transition ${currentVideoId === video.muxPlaybackId
                        ? 'bg-blue-100 font-semibold'
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    {video.title}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </aside>
  )
}

export default CoursePlayer
