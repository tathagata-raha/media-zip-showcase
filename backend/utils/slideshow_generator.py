import os
from pathlib import Path
from typing import List, Optional, Tuple
from moviepy.editor import ImageClip, VideoFileClip, AudioFileClip, CompositeVideoClip, concatenate_videoclips
from moviepy.video.fx import resize
import numpy as np

from config import settings
from models import TransitionEffect, SlideshowOptions

class SlideshowGenerator:
    """Generates video slideshows from image collections"""
    
    def __init__(self):
        self.supported_transitions = {
            TransitionEffect.NONE: self._no_transition,
            TransitionEffect.FADE: self._fade_transition,
            TransitionEffect.CROSSFADE: self._crossfade_transition
        }
    
    def generate_slideshow(
        self, 
        image_paths: List[Path], 
        output_path: Path,
        options: SlideshowOptions,
        background_music_path: Optional[Path] = None
    ) -> bool:
        """
        Generate slideshow video from images
        
        Args:
            image_paths: List of image file paths
            output_path: Output video file path
            options: Slideshow configuration options
            background_music_path: Optional background music file path
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not image_paths:
                raise ValueError("No images provided for slideshow")
            
            # Create image clips
            clips = []
            for img_path in image_paths:
                if not img_path.exists():
                    continue
                
                try:
                    clip = ImageClip(str(img_path), duration=options.image_duration)
                    # Resize to target resolution
                    clip = clip.resize(options.resolution)
                    clips.append(clip)
                except Exception as e:
                    print(f"Error processing image {img_path}: {e}")
                    continue
            
            if not clips:
                raise ValueError("No valid images found")
            
            # Apply transitions
            if options.transition_effect != TransitionEffect.NONE:
                clips = self._apply_transitions(clips, options.transition_effect)
            
            # Concatenate clips
            final_video = concatenate_videoclips(clips, method="compose")
            
            # Add background music if provided
            if background_music_path and background_music_path.exists():
                try:
                    audio_clip = AudioFileClip(str(background_music_path))
                    # Loop audio if it's shorter than video
                    if audio_clip.duration < final_video.duration:
                        loops_needed = int(final_video.duration / audio_clip.duration) + 1
                        # Create a list of audio clips and concatenate them properly
                        audio_clips = [audio_clip] * loops_needed
                        audio_clip = audio_clips[0]
                        for clip in audio_clips[1:]:
                            audio_clip = audio_clip.set_duration(audio_clip.duration + clip.duration)
                    
                    # Trim audio to video length
                    audio_clip = audio_clip.subclip(0, final_video.duration)
                    
                    # Set audio volume (reduce to 30% to not overpower)
                    audio_clip = audio_clip.volumex(0.3)
                    
                    # Combine video and audio
                    final_video = final_video.set_audio(audio_clip)
                    
                except Exception as e:
                    print(f"Error adding background music: {e}")
            
            # Write output video
            final_video.write_videofile(
                str(output_path),
                fps=24,
                codec='libx264',
                audio_codec='aac' if final_video.audio else None,
                temp_audiofile='temp-audio.m4a' if final_video.audio else None,
                remove_temp=True
            )
            
            # Clean up
            final_video.close()
            for clip in clips:
                clip.close()
            
            return True
            
        except Exception as e:
            print(f"Error generating slideshow: {e}")
            return False
    
    def _apply_transitions(self, clips: List[ImageClip], transition: TransitionEffect) -> List[ImageClip]:
        """Apply transitions between clips"""
        if len(clips) <= 1:
            return clips
        
        transition_func = self.supported_transitions.get(transition, self._no_transition)
        return transition_func(clips)
    
    def _no_transition(self, clips: List[ImageClip]) -> List[ImageClip]:
        """No transition effect"""
        return clips
    
    def _fade_transition(self, clips: List[ImageClip]) -> List[ImageClip]:
        """Apply fade transition between clips"""
        transition_duration = 0.5  # 0.5 seconds
        
        for i in range(len(clips) - 1):
            # Fade out current clip
            clips[i] = clips[i].fadeout(transition_duration)
            # Fade in next clip
            clips[i + 1] = clips[i + 1].fadein(transition_duration)
        
        return clips
    
    def _crossfade_transition(self, clips: List[ImageClip]) -> List[ImageClip]:
        """Apply crossfade transition between clips"""
        transition_duration = 0.5  # 0.5 seconds
        
        new_clips = []
        for i in range(len(clips)):
            if i == 0:
                # First clip: fade in only
                new_clips.append(clips[i].fadein(transition_duration))
            elif i == len(clips) - 1:
                # Last clip: fade out only
                new_clips.append(clips[i].fadeout(transition_duration))
            else:
                # Middle clips: crossfade in and fade out
                new_clips.append(clips[i].crossfadein(transition_duration).fadeout(transition_duration))
        
        return new_clips
    
    def get_video_info(self, video_path: Path) -> Optional[Tuple[int, int, float]]:
        """Get video dimensions and duration"""
        try:
            clip = VideoFileClip(str(video_path))
            width, height = clip.size
            duration = clip.duration
            clip.close()
            return (width, height, duration)
        except Exception:
            return None

# Global slideshow generator instance
slideshow_generator = SlideshowGenerator() 