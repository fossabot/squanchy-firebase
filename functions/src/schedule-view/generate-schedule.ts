import { FirebaseApp } from "../firebase"
import { Request, Response } from 'express'
import { Speaker, SchedulePage, Track } from "./schedule-view-data"
import { DayData, EventData, SubmissionData, PlaceData, TrackData, SpeakerData, UserData, LevelData } from "../firestore/data"
import { collection as firestoreCollection } from '../firestore/collection'

export const generateSchedule = (firebaseApp: FirebaseApp) => (_: Request, response: Response) => {
    const firestore = firebaseApp.firestore()
    const collection = firestoreCollection(firebaseApp)

    const days = collection<DayData>('days')
    const events = collection<EventData>('events')
    const submissions = collection<SubmissionData>('submissions')
    const places = collection<PlaceData>('places')
    const tracks = collection<TrackData>('tracks')
    const speakers = collection<SpeakerData>('speakers')
    const users = collection<UserData>('user_profiles')
    const levels = collection<LevelData>('levels')

    Promise.all([
        days,
        events,
        submissions,
        places,
        tracks,
        speakers,
        users,
        levels
    ]).then(([
        days,
        events,
        submissions,
        places,
        tracks,
        speakers,
        users,
        levels
    ]) => {
        const flattenedSpeakers = speakers.map(speaker => ({
            speaker,
            user: users.find(({ id }) => speaker.user_profile.id === id)!
        })).map(({ speaker, user }): Speaker => ({
            id: speaker.id,
            name: user.full_name,
            bio: speaker.bio,
            companyName: speaker.company_name,
            companyUrl: speaker.company_url,
            twitterUsername: speaker.twitter_handle,
            photoUrl: user.profile_pic,
            personalUrl: speaker.personal_url
        }))

        const schedulePages = firestore.collection('views')
            .doc('schedule')
            .collection('schedule_pages')

        return Promise.all(days.map(day => {
            const eventsOfTheDay = events.filter(event => event.day.id === day.id)
            const schedulePage: SchedulePage = {
                day,
                events: eventsOfTheDay.map(event => {
                    const submission = submissions.find(({ id }) => event.submission.id === id)!
                    const place = places.find(({ id }) => event.place.id === id) || null
                    const track = tracks.find(({ id }) => event.track.id === id) || null
                    const submissionLevel = submission.level

                    const level = submissionLevel
                        ? levels.find(({ id }) => submissionLevel.id === id)!.name
                        : null

                    const eventSpeakers = flattenedSpeakers.filter(({ id }) => (submission.speakers || []).findIndex(({ id: speakerId }) => speakerId === id) !== -1)

                    return {
                        id: event.id,
                        title: submission.title,
                        startTime: event.start_time,
                        endTime: event.end_time,
                        place: place,
                        track: trackFrom(track),
                        speakers: eventSpeakers,
                        experienceLevel: level,
                        type: event.type,
                        description: submission.abstract
                    }
                })
            }

            return schedulePages.doc(day.id).set(schedulePage)
        }))
    }).then(() => {
        response.status(200).send('Yay!')
    })
}

const trackFrom = (rawTrack: TrackData & { id: string } | null): Track | null => {
    if (rawTrack === null) {
        return null
    }
    return {
        id: rawTrack.id,
        name: rawTrack.name,
        accentColor: rawTrack.accent_color,
        textColor: rawTrack.text_color,
        iconUrl: rawTrack.icon_url
    }
}
