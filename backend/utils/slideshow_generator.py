import os
import psutil
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple
from moviepy.editor import ImageClip, VideoFileClip, AudioFileClip, CompositeVideoClip, concatenate_videoclips, ColorClip
from moviepy.video.fx import resize
import numpy as np
from PIL import Image
import gc

from config import settings
from models import TransitionEffect, SlideshowOptions

def log_memory_usage(stage: str):
    """Log memory usage at different stages"""
    process = psutil.Process(os.getpid())
    memory_mb = process.memory_info().rss / 1024 ** 2
    print(f"[DEBUG] {stage} - Memory usage: {memory_mb:.2f} MB")
    return memory_mb

def check_memory_limit(max_memory_mb: int = 1200) -> bool:
    """Check if memory usage is within safe limits"""
    memory_mb = log_memory_usage("Memory check")
    if memory_mb > max_memory_mb:
        print(f"[WARNING] Memory usage ({memory_mb:.2f} MB) exceeds limit ({max_memory_mb} MB)")
        return False
    return True

def create_slideshow_with_ffmpeg(
    image_paths: List[Path], 
    output_path: Path,
    options: SlideshowOptions,
    background_music_path: Optional[Path] = None
) -> bool:
    """Create slideshow using ffmpeg directly to avoid MoviePy memory issues"""
    try:
        print(f"[DEBUG] Creating slideshow with ffmpeg: {len(image_paths)} images")
        log_memory_usage("Starting ffmpeg slideshow")
        
        # Create temporary directory for processed images
        temp_dir = output_path.parent / "temp_slideshow"
        temp_dir.mkdir(exist_ok=True)
        
        # Process and resize images
        processed_images = []
        for i, img_path in enumerate(image_paths):
            if not img_path.exists():
                continue
                
            print(f"[DEBUG] Processing image {i+1}/{len(image_paths)}: {img_path.name}")
            log_memory_usage(f"Before processing image {i+1}")
            
            # Optimize image
            optimized_path = optimize_large_image(img_path)
            processed_images.append(optimized_path)
            
            # Force garbage collection
            gc.collect()
            log_memory_usage(f"After processing image {i+1}")
        
        if not processed_images:
            raise ValueError("No valid images found")
        
        # Create ffmpeg command for slideshow
        # Each image will be shown for the specified duration
        duration = options.image_duration
        width, height = options.resolution
        
        # Build ffmpeg command
        cmd = [
            'ffmpeg',
            '-y',  # Overwrite output
            '-f', 'image2',
            '-framerate', '1',  # 1 frame per second (we'll control duration differently)
            '-i', str(processed_images[0]),  # Input pattern
        ]
        
        # Add all images as inputs
        for img_path in processed_images[1:]:
            cmd.extend(['-i', str(img_path)])
        
        # Add background music if provided
        if background_music_path and background_music_path.exists():
            cmd.extend(['-i', str(background_music_path)])
        
        # Complex filter for slideshow
        filter_complex = []
        
        # Create video streams for each image
        for i in range(len(processed_images)):
            filter_complex.append(f'[{i}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setpts=PTS/{duration}[v{i}]')
        
        # Concatenate all video streams
        concat_inputs = ''.join([f'[v{i}]' for i in range(len(processed_images))])
        filter_complex.append(f'{concat_inputs}concat=n={len(processed_images)}:v=1:a=0[outv]')
        
        # Add audio if provided
        if background_music_path and background_music_path.exists():
            audio_index = len(processed_images)
            filter_complex.append(f'[{audio_index}:a]aloop=loop=-1:size=2*44100,atrim=0:{len(processed_images) * duration}[audio]')
            filter_complex.append('[outv][audio]amix=inputs=2:duration=first[out]')
            output_stream = '[out]'
        else:
            output_stream = '[outv]'
        
        # Add filter complex to command
        cmd.extend(['-filter_complex', ';'.join(filter_complex)])
        
        # Output settings
        cmd.extend([
            '-map', output_stream,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-movflags', 'faststart',
            str(output_path)
        ])
        
        print(f"[DEBUG] Running ffmpeg command: {' '.join(cmd)}")
        log_memory_usage("Before ffmpeg execution")
        
        # Execute ffmpeg
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[ERROR] ffmpeg failed: {result.stderr}")
            return False
        
        log_memory_usage("After ffmpeg execution")
        print(f"[DEBUG] ffmpeg slideshow created successfully: {output_path}")
        
        # Clean up temporary files
        for img_path in processed_images:
            if img_path != img_path:  # If it's a temporary optimized file
                try:
                    img_path.unlink()
                except:
                    pass
        
        return True
        
    except Exception as e:
        print(f"Error creating ffmpeg slideshow: {e}")
        return False

def optimize_large_image(image_path: Path, max_dimension: int = 1280) -> Path:  # Reduced from 1920 to 1280
    """Optimize large images to prevent memory issues"""
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            
            # If image is larger than max_dimension in either dimension, resize it
            if width > max_dimension or height > max_dimension:
                # Calculate new dimensions maintaining aspect ratio
                if width > height:
                    new_width = max_dimension
                    new_height = int(height * (max_dimension / width))
                else:
                    new_height = max_dimension
                    new_width = int(width * (max_dimension / height))
                
                # Resize the image
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Save to temporary file with higher compression
                temp_path = image_path.parent / f"temp_{image_path.name}"
                resized_img.save(temp_path, quality=75, optimize=True)  # Reduced quality from 85 to 75
                
                print(f"[DEBUG] Optimized large image: {image_path.name} ({width}x{height} -> {new_width}x{new_height})")
                return temp_path
            else:
                return image_path
    except Exception as e:
        print(f"[DEBUG] Failed to optimize image {image_path}: {e}")
        return image_path

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
        Generate slideshow video from images using multiple smaller slideshows
        
        Args:
            image_paths: List of image file paths
            output_path: Output video file path
            options: Slideshow configuration options
            background_music_path: Optional background music file path
            
        Returns:
            True if successful, False otherwise
        """
        temp_files = []  # Track temporary files for cleanup
        try:
            log_memory_usage("Starting slideshow generation")
            print(f"[DEBUG] Slideshow generation: {len(image_paths)} images, duration={options.image_duration}s, resolution={options.resolution}")
            
            if not image_paths:
                raise ValueError("No images provided for slideshow")
            
            # Process images in chunks of 10 to prevent memory accumulation
            chunk_size = 10
            chunk_videos = []
            
            for chunk_start in range(0, len(image_paths), chunk_size):
                chunk_end = min(chunk_start + chunk_size, len(image_paths))
                chunk_paths = image_paths[chunk_start:chunk_end]
                
                print(f"[DEBUG] Processing chunk {chunk_start//chunk_size + 1}: images {chunk_start+1}-{chunk_end}")
                log_memory_usage(f"Before chunk {chunk_start//chunk_size + 1}")
                
                # Create temporary output for this chunk
                chunk_output = output_path.parent / f"chunk_{chunk_start//chunk_size + 1}.mp4"
                
                # Process this chunk
                success = self._generate_chunk_slideshow(
                    chunk_paths, 
                    chunk_output, 
                    options, 
                    background_music_path,
                    temp_files
                )
                
                if success:
                    chunk_videos.append(chunk_output)
                    print(f"[DEBUG] Chunk {chunk_start//chunk_size + 1} completed: {chunk_output}")
                else:
                    print(f"[ERROR] Failed to generate chunk {chunk_start//chunk_size + 1}")
                
                # Force garbage collection after each chunk
                gc.collect()
                log_memory_usage(f"After chunk {chunk_start//chunk_size + 1}")
            
            if not chunk_videos:
                raise ValueError("No valid chunks generated")
            
            # Concatenate all chunk videos
            print(f"[DEBUG] Concatenating {len(chunk_videos)} chunk videos...")
            log_memory_usage("Before concatenating chunks")
            
            # Load all chunk videos
            video_clips = []
            for chunk_video in chunk_videos:
                try:
                    clip = VideoFileClip(str(chunk_video))
                    video_clips.append(clip)
                except Exception as e:
                    print(f"[ERROR] Failed to load chunk video {chunk_video}: {e}")
                    continue
            
            if not video_clips:
                raise ValueError("No valid chunk videos to concatenate")
            
            # Concatenate all videos
            final_video = concatenate_videoclips(video_clips, method="compose")
            log_memory_usage("After concatenating chunks")
            print(f"[DEBUG] Video concatenation complete. Duration: {final_video.duration}s")
            
            # Write final output
            print(f"[DEBUG] Writing final slideshow to {output_path}")
            log_memory_usage("Before writing final video")
            final_video.write_videofile(
                str(output_path),
                fps=24,
                codec='libx264',
                audio_codec='aac' if final_video.audio else None,
                temp_audiofile='temp-audio.m4a' if final_video.audio else None,
                remove_temp=True,
                ffmpeg_params=['-movflags', 'faststart']
            )
            log_memory_usage("After writing final video")
            print(f"[DEBUG] Final slideshow written successfully")
            
            # Clean up
            print(f"[DEBUG] Cleaning up resources...")
            final_video.close()
            for clip in video_clips:
                clip.close()
            
            # Clean up chunk videos
            for chunk_video in chunk_videos:
                try:
                    if chunk_video.exists():
                        chunk_video.unlink()
                        print(f"[DEBUG] Cleaned up chunk video: {chunk_video.name}")
                except Exception as e:
                    print(f"[DEBUG] Failed to clean up {chunk_video}: {e}")
            
            # Clean up temporary files
            for temp_file in temp_files:
                try:
                    if temp_file.exists():
                        temp_file.unlink()
                        print(f"[DEBUG] Cleaned up temporary file: {temp_file.name}")
                except Exception as e:
                    print(f"[DEBUG] Failed to clean up {temp_file}: {e}")
            
            log_memory_usage("After cleanup")
            print(f"[DEBUG] Slideshow generation complete: {output_path}")
            
            return True
            
        except Exception as e:
            print(f"Error generating slideshow: {e}")
            # Clean up temporary files on error
            for temp_file in temp_files:
                try:
                    if temp_file.exists():
                        temp_file.unlink()
                except:
                    pass
            return False
    
    def _generate_chunk_slideshow(
        self,
        image_paths: List[Path],
        output_path: Path,
        options: SlideshowOptions,
        background_music_path: Optional[Path],
        temp_files: List[Path]
    ) -> bool:
        """Generate slideshow for a chunk of images"""
        try:
            print(f"[DEBUG] Generating chunk slideshow for {len(image_paths)} images")
            
            # Create image clips
            clips = []
            for i, img_path in enumerate(image_paths):
                if not img_path.exists():
                    print(f"[DEBUG] Skipping non-existent image: {img_path}")
                    continue
                
                try:
                    print(f"[DEBUG] Processing image {i+1}/{len(image_paths)}: {img_path.name}")
                    log_memory_usage(f"Before processing image {i+1}")
                    
                    # Check memory limit before processing each image
                    if not check_memory_limit(1200):  # 1.2GB limit
                        print(f"[ERROR] Memory limit exceeded, stopping chunk generation")
                        raise MemoryError("Memory usage too high for safe processing")
                    
                    # Optimize large images to prevent memory issues
                    optimized_path = optimize_large_image(img_path)
                    if optimized_path != img_path:
                        temp_files.append(optimized_path)
                    
                    clip = ImageClip(str(optimized_path), duration=options.image_duration)
                    # Resize maintaining aspect ratio and center on black background
                    clip = self._resize_with_letterbox(clip, options.resolution)
                    clips.append(clip)
                    print(f"[DEBUG] Successfully created clip for {img_path.name}")
                    
                    # Force garbage collection after each image
                    gc.collect()
                    
                except Exception as e:
                    print(f"Error processing image {img_path}: {e}")
                    continue
            
            if not clips:
                print(f"[ERROR] No valid clips created for chunk")
                return False
            
            # Apply transitions
            if options.transition_effect != TransitionEffect.NONE:
                print(f"[DEBUG] Applying transitions to chunk")
                clips = self._apply_transitions(clips, options.transition_effect)
            
            # Concatenate clips
            print(f"[DEBUG] Concatenating {len(clips)} clips for chunk")
            chunk_video = concatenate_videoclips(clips, method="compose")
            log_memory_usage("After concatenating chunk clips")
            
            # Add background music if provided
            if background_music_path and background_music_path.exists():
                print(f"[DEBUG] Adding background music to chunk")
                try:
                    audio_clip = AudioFileClip(str(background_music_path))
                    # Loop audio if it's shorter than video
                    if audio_clip.duration < chunk_video.duration:
                        loops_needed = int(chunk_video.duration / audio_clip.duration) + 1
                        audio_clips = [audio_clip] * loops_needed
                        audio_clip = audio_clips[0]
                        for clip in audio_clips[1:]:
                            audio_clip = audio_clip.set_duration(audio_clip.duration + clip.duration)
                    
                    # Trim audio to video length
                    audio_clip = audio_clip.subclip(0, chunk_video.duration)
                    audio_clip = audio_clip.volumex(0.3)
                    chunk_video = chunk_video.set_audio(audio_clip)
                    
                except Exception as e:
                    print(f"Error adding background music to chunk: {e}")
            
            # Write chunk video
            print(f"[DEBUG] Writing chunk video to {output_path}")
            chunk_video.write_videofile(
                str(output_path),
                fps=24,
                codec='libx264',
                audio_codec='aac' if chunk_video.audio else None,
                temp_audiofile='temp-audio.m4a' if chunk_video.audio else None,
                remove_temp=True,
                ffmpeg_params=['-movflags', 'faststart']
            )
            
            # Clean up chunk resources
            chunk_video.close()
            for clip in clips:
                clip.close()
            
            print(f"[DEBUG] Chunk slideshow completed successfully")
            return True
            
        except Exception as e:
            print(f"Error generating chunk slideshow: {e}")
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
    
    def _resize_with_letterbox(self, clip: ImageClip, target_resolution: Tuple[int, int]) -> ImageClip:
        """Resize clip maintaining aspect ratio with black letterboxing"""
        target_width, target_height = target_resolution
        clip_width, clip_height = clip.size
        
        # Calculate aspect ratios
        target_aspect = target_width / target_height
        clip_aspect = clip_width / clip_height
        
        # Determine scaling to fit within target resolution while maintaining aspect ratio
        if clip_aspect > target_aspect:
            # Image is wider - scale by width (letterbox top/bottom)
            scale_factor = target_width / clip_width
            new_width = target_width
            new_height = int(clip_height * scale_factor)
        else:
            # Image is taller - scale by height (letterbox left/right)
            scale_factor = target_height / clip_height
            new_width = int(clip_width * scale_factor)
            new_height = target_height
        
        # Resize the clip to fit
        resized_clip = clip.resize((new_width, new_height))
        
        # Create black background with target resolution
        background = ColorClip(
            size=(target_width, target_height),
            color=(0, 0, 0),  # Black
            duration=clip.duration
        )
        
        # Center the resized clip on the background
        x_offset = (target_width - new_width) // 2
        y_offset = (target_height - new_height) // 2
        
        # Composite the resized image centered on black background
        final_clip = CompositeVideoClip([
            background,
            resized_clip.set_position((x_offset, y_offset))
        ], size=(target_width, target_height))
        
        return final_clip
    
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