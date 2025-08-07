/**
 * Gołąb Contact Form - React/JSX Example
 * 
 * A React component for integrating with the Gołąb contact form API.
 * "Gołąb" means "pigeon" in Polish - your reliable carrier pigeon for messages!
 */

import React, { useState, FormEvent } from 'react';

// Types for the contact form
interface ContactFormData {
  email: string;
  subject: string;
  message: string;
}

interface ContactFormResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
  timestamp: string;
}

// Configuration - Update this to your deployed Gołąb API endpoint
const API_ENDPOINT = 'https://your-golab-api.workers.dev/api/contact';

// 🔑 OPTIONAL: Set your API key if authentication is enabled
// Generate with: openssl rand -base64 32
const API_KEY: string = ''; // Leave empty if API key authentication is disabled

// Contact Form Component
export const GolabContactForm: React.FC = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    email: '',
    subject: '',
    message: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Basic client-side validation
    if (!formData.email || !formData.subject || !formData.message) {
      showMessage('Please fill in all fields.', 'error');
      return;
    }

    if (formData.message.length < 10) {
      showMessage('Message must be at least 10 characters long.', 'error');
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add API key header if configured
      if (API_KEY && API_KEY.trim() !== '') {
        headers['X-API-Key'] = API_KEY;
      }

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(formData)
      });

      const result: ContactFormResponse | ApiError = await response.json();

      if (response.ok && 'success' in result && result.success) {
        showMessage(result.message || 'Message sent successfully! 🕊️', 'success');
        setFormData({ email: '', subject: '', message: '' });
      } else {
        let errorMessage = 'Failed to send message. Please try again.';
        
        if ('error' in result) {
          errorMessage = result.error;
        }
        
        if ('details' in result && result.details && result.details.length > 0) {
          errorMessage += ' Issues: ' + result.details.map(d => d.message).join(', ');
        }
        
        showMessage(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showMessage('Network error. Please check your connection and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const remainingChars = 5000 - formData.message.length;

  return (
    <div className="golab-contact-form">
      <div className="golab-header">
        <h2>
          <span className="golab-pigeon-icon">🕊️</span>
          Contact Us
        </h2>
        <p className="golab-subtitle">Send us a message via our carrier pigeon</p>
      </div>

      {message && (
        <div className={`golab-message golab-message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="golab-form">
        <div className="golab-form-group">
          <label htmlFor="golab-email" className="golab-label">
            Email Address
          </label>
          <input
            type="email"
            id="golab-email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="golab-input"
            disabled={isLoading}
          />
        </div>

        <div className="golab-form-group">
          <label htmlFor="golab-subject" className="golab-label">
            Subject
          </label>
          <input
            type="text"
            id="golab-subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            required
            maxLength={200}
            className="golab-input"
            disabled={isLoading}
          />
        </div>

        <div className="golab-form-group">
          <label htmlFor="golab-message" className="golab-label">
            Message
            {remainingChars < 100 && (
              <span className={`golab-char-counter ${remainingChars < 20 ? 'golab-char-counter--warning' : ''}`}>
                ({remainingChars} characters remaining)
              </span>
            )}
          </label>
          <textarea
            id="golab-message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            className="golab-textarea"
            placeholder="Write your message here..."
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`golab-submit-btn ${isLoading ? 'golab-submit-btn--loading' : ''}`}
        >
          {isLoading ? (
            <>
              <span className="golab-spinner"></span>
              Sending...
            </>
          ) : (
            <>Send Message 🕊️</>
          )}
        </button>
      </form>

      <div className="golab-footer">
        <p><strong>Gołąb</strong> - Polish for "pigeon" 🕊️</p>
        <p>A carrier pigeon service for your contact forms</p>
      </div>
    </div>
  );
};

// CSS Styles (you can move this to a separate CSS file)
export const golabContactFormStyles = `
.golab-contact-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.golab-header {
  text-align: center;
  margin-bottom: 30px;
}

.golab-header h2 {
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 28px;
}

.golab-pigeon-icon {
  font-size: 32px;
  margin-right: 10px;
}

.golab-subtitle {
  color: #6c757d;
  font-size: 16px;
}

.golab-message {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-weight: 500;
}

.golab-message--success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.golab-message--error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.golab-form-group {
  margin-bottom: 20px;
}

.golab-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #495057;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.golab-char-counter {
  font-weight: normal;
  text-transform: none;
  margin-left: 8px;
  color: #ffc107;
}

.golab-char-counter--warning {
  color: #dc3545;
}

.golab-input,
.golab-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  font-family: inherit;
}

.golab-input:focus,
.golab-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.golab-textarea {
  resize: vertical;
  min-height: 120px;
}

.golab-submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
  border: none;
  padding: 14px 20px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.golab-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 123, 255, 0.3);
}

.golab-submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.golab-submit-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.golab-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff40;
  border-top: 2px solid #ffffff;
  border-radius: 50%;
  animation: golab-spin 1s linear infinite;
}

@keyframes golab-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.golab-footer {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
  color: #6c757d;
  font-size: 14px;
}

@media (max-width: 600px) {
  .golab-contact-form {
    padding: 30px 20px;
  }
  
  .golab-header h2 {
    font-size: 24px;
  }
}
`;

// Usage example:
export const ExampleUsage: React.FC = () => {
  return (
    <div>
      <style>{golabContactFormStyles}</style>
      <GolabContactForm />
    </div>
  );
};

// Hook version for more flexibility
export const useGolabContactForm = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    email: '',
    subject: '',
    message: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const submitForm = async (data: ContactFormData): Promise<boolean> => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add API key header if configured
      if (API_KEY && API_KEY.trim() !== '') {
        headers['X-API-Key'] = API_KEY;
      }

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });

      const result: ContactFormResponse | ApiError = await response.json();

      if (response.ok && 'success' in result && result.success) {
        setMessage({ 
          text: result.message || 'Message sent successfully!',
          type: 'success' 
        });
        return true;
      } else {
        let errorMessage = 'Failed to send message. Please try again.';
        
        if ('error' in result) {
          errorMessage = result.error;
        }
        
        if ('details' in result && result.details && result.details.length > 0) {
          errorMessage += ' Issues: ' + result.details.map(d => d.message).join(', ');
        }
        
        setMessage({ text: errorMessage, type: 'error' });
        return false;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessage({ 
        text: 'Network error. Please check your connection and try again.', 
        type: 'error' 
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    isLoading,
    message,
    setMessage,
    submitForm
  };
};

export default GolabContactForm;
