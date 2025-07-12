import React, { useEffect } from 'react';
import 'media-chrome';

// Declare the custom elements for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'media-controller': any;
      'media-control-bar': any;
      'media-play-button': any;
      'media-seek-backward-button': any;
      'media-seek-forward-button': any;
      'media-mute-button': any;
      'media-volume-range': any;
      'media-time-range': any;
      'media-time-display': any;
      'media-duration-display': any;
      'media-fullscreen-button': any;
    }
  }
}

export default function TestVideo() {
  const testVideoUrl = "/api/media/0b705fea-032e-41ab-a5f5-d323ea1f27d8/amaleaked.pk-Eliza-25.mov";
  useEffect(() => {
    // Import media-chrome components and ensure polyfills for Edge
    const loadMediaChrome = async () => {
      // Load polyfills for older browsers (Edge)
      if (!window.customElements) {
        await import('@webcomponents/custom-elements');
      }
      
      // Load media-chrome
      await import('media-chrome');
      
      // Force a small delay to ensure components are registered
      setTimeout(() => {
        console.log('Media Chrome components loaded');
      }, 100);
    };
    
    loadMediaChrome();
  }, []);

  return (
    <div style={{ padding: 20, background: 'white' }}>
      <h1>Test Video Player with Media Chrome</h1>
      <p>Testing Media Chrome controls to see if the slider works properly in Edge.</p>
      
      <media-controller 
        style={{ 
          width: '600px', 
          height: '400px',
          display: 'block',
          position: 'relative'
        }}
      >
        <video
          slot="media"
          src={testVideoUrl}
          preload="metadata"
          playsInline
          style={{ 
            width: '100%', 
            height: '100%',
            display: 'block',
            backgroundColor: 'black'
          }}
        />
        <media-control-bar 
          style={{ 
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: '10'
          }}
        >
          <media-play-button></media-play-button>
          <media-seek-backward-button seekoffset="5"></media-seek-backward-button>
          <media-seek-forward-button seekoffset="5"></media-seek-forward-button>
          <media-time-display showduration></media-time-display>
          <media-time-range style={{ flex: '1', minWidth: '100px' }}></media-time-range>
          <media-duration-display></media-duration-display>
          <media-mute-button></media-mute-button>
          <media-volume-range></media-volume-range>
          <media-fullscreen-button></media-fullscreen-button>
        </media-control-bar>
      </media-controller>
      
      <p style={{ marginTop: 10 }}>
        If the Media Chrome slider works here, we can implement it in the main MediaPlayer component.
      </p>
    </div>
  );
} 