import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createAdminReel } from '../../services/adminService';
import { useCategories } from '../../hooks/useCategories';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errors';
import ReelFields, { toApiFields } from '../../components/admin/ReelFields';

const MAX_VIDEO_MB = 50; // keep in sync with MAX_VIDEO_MB on the server
const EMPTY = {
  title: '',
  description: '',
  category: '',
  level: 'beginner',
  status: 'published',
  tags: '',
  keyTakeaway: '',
  creditName: '',
  resources: [],
};

export default function UploadReel() {
  usePageTitle('Upload reel');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { categories, loading: categoriesLoading } = useCategories();
  const [values, setValues] = useState(EMPTY);
  const [video, setVideo] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [duration, setDuration] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const videoInput = useRef(null);

  useEffect(() => {
    if (!video) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(video);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  function handleVideoChange(event) {
    const file = event.target.files?.[0];
    setError('');
    setDuration(null);
    if (!file) return setVideo(null);
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setError('Please choose an MP4 or WebM video.');
      event.target.value = '';
      return setVideo(null);
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`The video is larger than ${MAX_VIDEO_MB} MB. Compress it and try again.`);
      event.target.value = '';
      return setVideo(null);
    }
    setVideo(file);
  }

  function handleThumbChange(event) {
    const file = event.target.files?.[0];
    setError('');
    if (!file) return setThumbnail(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Thumbnail must be a JPG, PNG or WebP image under 5 MB.');
      event.target.value = '';
      return setThumbnail(null);
    }
    setThumbnail(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!video) return setError('Please choose a video file.');
    if (!values.category) return setError('Please choose a category.');

    const fields = toApiFields(values);
    const body = new FormData();
    body.append('video', video);
    if (thumbnail) body.append('thumbnail', thumbnail);
    Object.entries(fields).forEach(([key, value]) => {
      body.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
    });
    if (duration) body.append('durationSec', String(Math.round(duration)));

    setUploading(true);
    setProgress(0);
    try {
      await createAdminReel(body, setProgress);
      showToast('Reel uploaded.', 'success');
      navigate('/admin/reels');
    } catch (err) {
      setError(getErrorMessage(err, 'The upload failed. Nothing was saved.'));
      setUploading(false);
    }
  }

  return (
    <>
      <h1>Upload a reel</h1>
      {!categoriesLoading && categories.length === 0 && (
        <div className="error-box" role="alert">
          <p>
            Create at least one category first (run <code>npm run seed</code> in the backend, or add one in{' '}
            <Link to="/admin/reels">Manage content</Link>).
          </p>
        </div>
      )}

      <form className="card upload-form" onSubmit={handleSubmit}>
        <label htmlFor="upload-video">Video (MP4 or WebM, up to {MAX_VIDEO_MB} MB, ideally 20 to 90 seconds)</label>
        <input id="upload-video" ref={videoInput} type="file" accept="video/mp4,video/webm" onChange={handleVideoChange} />
        {previewUrl && (
          <video
            className="upload-preview"
            src={previewUrl}
            controls
            muted
            playsInline
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          />
        )}
        {duration ? <p className="muted small">Detected length: {Math.round(duration)} seconds</p> : null}

        <label htmlFor="upload-thumb">Thumbnail image (optional, a frame from the video is used if you skip it)</label>
        <input id="upload-thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumbChange} />

        <ReelFields values={values} onChange={setValues} categories={categories} idPrefix="upload" />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {uploading && (
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
            <small>{progress < 100 ? `Uploading… ${progress}%` : 'Processing…'}</small>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload reel'}
        </button>
      </form>
    </>
  );
}
