import React, { useState, useRef, useCallback, useEffect } from 'react';

function VideoRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(''); // For the *recorded* video preview
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const videoLivePreviewRef = useRef(null); // Ref for the LIVE preview video element
  const recordedChunksRef = useRef([]);

  const cleanupStream = useCallback(() => {
    // console.log("Cleanup Stream Called. Current mediaStream:", mediaStream);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        // console.log("Stopping track:", track.kind, track.label);
        track.stop();
      });
      setMediaStream(null);
    }
    // Also clear the srcObject of the live preview element if it's still holding the stream
    if (videoLivePreviewRef.current && videoLivePreviewRef.current.srcObject) {
        // console.log("Clearing srcObject from live preview ref during cleanupStream");
        videoLivePreviewRef.current.srcObject = null;
    }
  }, [mediaStream]); // Dependency: mediaStream, as it's used in the logic

  const startRecording = async () => {
    setError('');
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream); // This will trigger the useEffect for srcObject

      if (!window.MediaRecorder) {
          setError('MediaRecorder API not supported in this browser.');
          cleanupStream(); // Call cleanup if there's an early exit
          return;
      }
      
      const mimeTypesToTry = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=avc1,mp4a', // May have broader playback but less recording support
        'video/webm'
      ];
      
      const supportedMimeType = mimeTypesToTry.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
          setError('No supported MIME type found for MediaRecorder.');
          console.warn('Supported types check failed. Available types on this browser might be limited.');
          // Fallback to let the browser decide, or use a very common default
          // const veryBasicMimeType = 'video/webm'; // or leave options undefined
          // if (!MediaRecorder.isTypeSupported(veryBasicMimeType) && !options) { ... }
          cleanupStream(); 
          return;
      }
      
      console.log('Using MIME type:', supportedMimeType);
      const options = { mimeType: supportedMimeType };
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url); // This is for the *recorded* video preview
        
        // It's important to call cleanupStream here AFTER the blob is created
        // and the preview URL is set, because cleanupStream will nullify mediaStream.
        cleanupStream(); 
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing media devices or starting recording:", err);
      let detailedError = `Error: ${err.name} - ${err.message}.`;
      if (window.location.protocol !== 'https:') {
        detailedError += " Camera/mic access requires HTTPS.";
      } else {
        detailedError += " Ensure camera/mic permissions are granted and no other app is using the camera.";
      }
      setError(detailedError);
      cleanupStream(); // Call cleanup on error
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); // This triggers the 'onstop' handler which then calls cleanupStream
      setIsRecording(false);
      // Note: cleanupStream is now primarily called from mediaRecorder.onstop or unmount
    }
  };

  const handleSendVideo = () => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob); 
      setRecordedBlob(null); 
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
    }
  };

  const handleDiscardVideo = () => {
    setRecordedBlob(null);
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
    }
    setError('');
    recordedChunksRef.current = [];
    // If the stream was somehow active and not cleaned up, ensure it is.
    // This state usually means user wants to re-record from scratch.
    cleanupStream(); 
  };

  // EFFECT HOOK 1: For managing the live preview video element's srcObject
  useEffect(() => {
    const currentVideoLiveRef = videoLivePreviewRef.current;

    if (isRecording && mediaStream && currentVideoLiveRef) {
      console.log("LIVE PREVIEW EFFECT: Setting srcObject:", mediaStream);
      currentVideoLiveRef.srcObject = mediaStream;
      currentVideoLiveRef.play().catch(e => console.error("Error trying to play live preview:", e));
    } 
    // No explicit 'else if' to clear srcObject here, 
    // as cleanupStream (called on stop or discard) should handle it by nullifying mediaStream
    // and its own logic for clearing videoLivePreviewRef.current.srcObject.
    // This prevents potential race conditions or premature clearing.
  }, [isRecording, mediaStream]); // Dependencies for this effect

  // EFFECT HOOK 2: For cleanup on component unmount
  useEffect(() => {
    // Store the functions and previewUrl in refs if they are to be used in cleanup,
    // to avoid them being stale if the dependency array is empty.
    // However, for `cleanupStream` (defined with useCallback and depending on `mediaStream`)
    // and `previewUrl` (state), including them in dependencies is correct.
    const currentPreviewUrl = previewUrl; // Capture current previewUrl for cleanup

    return () => {
      console.log("VideoRecorder UNMOUNT: Performing cleanup.");
      cleanupStream(); 
      if (currentPreviewUrl) { 
        URL.revokeObjectURL(currentPreviewUrl);
        // console.log("VideoRecorder UNMOUNT: Revoked recorded preview URL:", currentPreviewUrl);
      }
    };
  }, [cleanupStream, previewUrl]); // Add stable `cleanupStream` and `previewUrl`


  return (
    <div style={{ border: '1px solid #ddd', padding: '10px', margin: '10px 0' }}>
      <h4>Video Recorder</h4>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {/* Live preview while recording */}
      {isRecording && (
        <div>
          <p>Recording...</p>
          <video 
            ref={videoLivePreviewRef} 
            autoPlay 
            muted 
            playsInline 
            style={{ width: '320px', height: '240px', border:'1px solid black', backgroundColor: '#333' }} 
          />
        </div>
      )}

      {/* Buttons for starting/stopping */}
      {!isRecording && !previewUrl && (
        <button onClick={startRecording} type="button">Start Recording</button>
      )}
      {isRecording && (
        <button onClick={stopRecording} type="button">Stop Recording</button>
      )}

      {/* Preview of recorded video */}
      {previewUrl && !isRecording && (
        <div style={{ marginTop: '10px' }}>
          <p>Preview of recorded video:</p>
          <video src={previewUrl} controls style={{ width: '320px', height: '240px', border:'1px solid black' }} />
          <div>
            <button onClick={handleSendVideo} type="button" style={{ marginRight: '5px' }}>Use this video</button>
            <button onClick={handleDiscardVideo} type="button">Discard & Re-record</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoRecorder;