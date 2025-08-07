// pages/movies/[id].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { db, auth } from '../../lib/firebase'
import {
    collection, addDoc, query, where, getDocs,
    orderBy, deleteDoc, doc, getDoc
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion' // ← 追加


export default function MovieDetail() {
    const router = useRouter()
    const { id } = router.query
    const [movie, setMovie] = useState(null)
    const [watchProviders, setWatchProviders] = useState([])
    const [comment, setComment] = useState('')
    const [rating, setRating] = useState(5)
    const [comments, setComments] = useState([])
    const [user, setUser] = useState(null)
    const [isNowPlaying, setIsNowPlaying] = useState(false)
    const [showAd, setShowAd] = useState(false)
    const [adImage, setAdImage] = useState('')

    const providerLinks = {
        "Netflix": "https://www.netflix.com/",
        "Disney Plus": "https://www.disneyplus.com/",
        "Amazon Prime Video": "https://www.amazon.co.jp/gp/video/storefront",
        "U-NEXT": "https://video.unext.jp/",
        "Hulu": "https://www.hulu.jp/",
        "Apple TV+": "https://tv.apple.com/",
        "dTV": "https://lemino.docomo.ne.jp/",
        "Rakuten TV": "https://tv.rakuten.co.jp/",
        "WOWOW": "https://www.wowow.co.jp/"
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userDoc = await getDoc(doc(db, "users", currentUser.uid))
                const isAdmin = userDoc.exists() && userDoc.data().admin === true
                setUser({ ...currentUser, isAdmin })
            } else {
                setUser(null)
            }
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        if (!id) return
        const fetchMovie = async () => {
            const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=ja-JP`, {
                headers: {
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`
                }
            })
            const data = await res.json()
            setMovie(data)

            const checkNowPlaying = async () => {
                const nowPlayingRes = await fetch(`https://api.themoviedb.org/3/movie/now_playing?language=ja-JP&region=JP`, {
                    headers: {
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`
                    }
                })
                const nowPlayingData = await nowPlayingRes.json()
                const movieIdsNowPlaying = nowPlayingData.results.map(m => m.id)
                setIsNowPlaying(movieIdsNowPlaying.includes(data.id))
            }
            await checkNowPlaying()

            const watchRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers`, {
                headers: {
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN}`
                }
            })
            const watchData = await watchRes.json()
            const jpProviders = (watchData.results?.JP?.flatrate || [])
                .filter(p => providerLinks[p.provider_name])
            setWatchProviders(jpProviders)
        }
        fetchMovie()
    }, [id])

    const saveReview = async () => {
        if (!user) return alert("ログインしてください")
        await addDoc(collection(db, "reviews"), {
            movieId: id,
            text: comment,
            rating,
            uid: user.uid,
            timestamp: new Date()
        });

        const randomImage = `ad${Math.floor(Math.random() * 4) + 1}.jpg`
        setAdImage(randomImage)
        setShowAd(true)
    }

    const fetchReviews = async () => {
        const q = query(
            collection(db, "reviews"),
            where("movieId", "==", id),
            orderBy("timestamp", "desc")
        )
        const snapshot = await getDocs(q)
        const fetched = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        setComments(fetched)
    }

    useEffect(() => {
        if (id) fetchReviews()
    }, [id])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!comment.trim()) return
        await saveReview()
        setComment('')
        setRating(5)
        fetchReviews()
    }

    const handleDelete = async (reviewId) => {
        await deleteDoc(doc(db, "reviews", reviewId))
        fetchReviews()
    }

    if (!movie) return <div className="text-white p-6">読み込み中...</div>

    return (
        <>
            {/* 広告オーバーレイ */}
            {showAd && (
                <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="relative"
                    >
                        <a
                            href="https://elog.tokyo/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            <div className="bg-white p-4 rounded-lg shadow-lg relative w-full max-w-[380px] hover:shadow-2xl transition">
                                {/* × ボタン（リンクに反応させないように stopPropagation） */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowAd(false)
                                    }}
                                    className="absolute top-1 right-1 text-black bg-white bg-opacity-90 rounded-full text-[10px] px-[5px] py-[2px] z-10 hover:bg-opacity-100"
                                >
                                    ×
                                </button>

                                <div className="text-center font-bold text-green-700 text-sm mb-2">
                                    🎯おすすめアプリ広告
                                </div>
                                <img
                                    src={`/ads/${adImage}`}
                                    alt="Ad"
                                    className="rounded border border-gray-300 hover:opacity-90 transition"
                                />
                            </div>
                        </a>
                    </motion.div>
                </div>
            )}

            {/* 本体 */}
            <div className="min-h-screen bg-black text-white p-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/3 space-y-6">
                        <img
                            src="/noimage.png"
                            alt="No image"
                            className="rounded shadow-lg w-full"
                        />
                        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 p-4 rounded space-y-4">
                            <h2 className="text-xl font-semibold">レビューを書く</h2>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="映画の感想を入力"
                                className="w-full p-2 rounded bg-black border border-gray-600 text-white"
                            />
                            <div className="flex items-center gap-2">
                                <span>評価:</span>
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setRating(num)}
                                        className="focus:outline-none"
                                    >
                                        <span className={`text-2xl ${num <= rating ? 'text-yellow-400' : 'text-gray-500'}`}>
                                            ★
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                                送信する
                            </button>
                        </form>
                    </div>

                    <div className="md:w-2/3 space-y-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{movie.title}</h1>
                            <p className="text-gray-300">{movie.overview}</p>

                            {isNowPlaying && (
                                <a
                                    href={`https://eiga.com/now/q/?title=${encodeURIComponent(movie.title)}&region=&pref=&area=&genre=on&sort=release`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white py-2 px-4 rounded mt-4"
                                >
                                    🎬 「{movie.title}」を映画館で探す（映画.com）
                                </a>
                            )}
                        </div>

                        {watchProviders.length > 0 && (
                            <div>
                                <h2 className="text-2xl font-semibold mb-2">配信中のサブスク</h2>
                                <div className="flex gap-4 flex-wrap">
                                    {watchProviders.map((provider) => (
                                        <a
                                            key={provider.provider_id}
                                            href={providerLinks[provider.provider_name]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 bg-gray-800 p-2 rounded hover:bg-gray-700"
                                        >
                                            <img
                                                src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                                                alt={provider.provider_name}
                                                className="w-6 h-6"
                                            />
                                            <span>{provider.provider_name}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h2 className="text-2xl font-semibold mb-2">みんなのレビュー</h2>
                            {comments.length === 0 ? (
                                <p className="text-gray-500">まだレビューはありません。</p>
                            ) : (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                    {comments.map((c) => (
                                        <div key={c.id} className="bg-gray-800 p-4 rounded shadow relative">
                                            <div className="text-yellow-400 text-lg mb-1">{'⭐'.repeat(c.rating)}</div>
                                            <p className="text-white">{c.text}</p>
                                            {(user?.uid === c.uid || user?.isAdmin) && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="absolute top-2 right-2 text-sm text-red-400 hover:text-red-200"
                                                >
                                                    削除
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
