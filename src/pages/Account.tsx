import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  User, 
  Users, 
  Shield, 
  Lock, 
  Eye, 
  Home as HomeIcon, 
  Briefcase, 
  MapPin, 
  Globe, 
  MessageSquare, 
  Calendar, 
  Moon, 
  LogOut, 
  Trash2,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { BottomNavigation } from '../components/BottomNavigation';
import { ScrollableSection } from '../components/ScrollableSection';
import { useUserProfile } from '../hooks/useUserProfile';
import { useTheme } from '../contexts/ThemeContext';
import { SavedPlace, SavedPlaces } from '../types';

export const Account: React.FC = () => {
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const { profile, uploadProfilePicture, updateProfile } = useUserProfile(userId);
  const [uploading, setUploading] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const userInfo = {
    name: profile?.name || 'User',
    rating: 4.55
  };

  const savedPlaces = profile?.savedPlaces || { custom: [] };
  const openSavedPlace = (mode: 'home' | 'work' | 'custom', place?: SavedPlace) => {
    navigate('/saved-place', { state: { mode, place, savedPlaces } });
  };

  const accountSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Personal info', action: () => navigate('/personal-info') },
        { icon: Users, label: 'Family profile', action: () => {} },
        { icon: Shield, label: 'Safety', action: () => {} },
        { icon: Lock, label: 'Login & security', action: () => navigate('/login-security') },
        { icon: Eye, label: 'Privacy', action: () => {} }
      ]
    },
    {
      title: 'Saved places',
      items: [
        { icon: HomeIcon, label: savedPlaces.home?.address || 'Enter home location', subtitle: savedPlaces.home ? 'Home' : undefined, action: () => openSavedPlace('home', savedPlaces.home) },
        { icon: Briefcase, label: savedPlaces.work?.address || 'Enter work location', subtitle: savedPlaces.work ? 'Work' : undefined, action: () => openSavedPlace('work', savedPlaces.work) },
        ...(savedPlaces.custom.length < 6 ? [{ icon: Plus, label: 'Add a place', action: () => openSavedPlace('custom') }] : []),
        ...savedPlaces.custom.map(place => ({ icon: MapPin, label: place.address, subtitle: place.title, action: () => openSavedPlace('custom', place) }))
      ]
    },
    {
      title: 'Settings',
      items: [
        { icon: Globe, label: 'Language', subtitle: 'English - US', action: () => {} },
        { icon: MessageSquare, label: 'Communication preferences', action: () => {} },
        { icon: Calendar, label: 'Calendars', action: () => {} },
        { icon: Moon, label: 'Dark mode', action: toggleTheme, toggle: true, toggleOn: isDark }
      ]
    },
    {
      title: 'Account Actions',
      items: [
        { icon: LogOut, label: 'Log out', action: handleLogout, danger: false },
        { icon: Trash2, label: 'Delete account', action: () => {}, danger: true }
      ]
    }
  ];

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          setUploading(true);
          const secureUrl = await uploadProfilePicture(file);

          // Update profile with the Cloudinary-hosted image URL
          await updateProfile({
            name: profile?.name || 'User',
            phone: profile?.phone || '',
            email: profile?.email || '',
            profilePicture: secureUrl
          });
        } catch (error) {
          console.error('Failed to upload image:', error);
          alert('Failed to upload image. Please try again.');
        } finally {
          setUploading(false);
        }
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header with Profile */}
      <motion.div 
        className="bg-white dark:bg-gray-900 pt-12 pb-6"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="text-center">
          <div className="relative inline-block mb-4">
            {profile?.profilePicture ? (
              <img 
                src={profile.profilePicture} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-[#7B5EFF] to-[#5B2EFF] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {userInfo.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <button
              onClick={handleImageUpload}
              disabled={uploading}
              className={`absolute -bottom-1 -right-1 w-8 h-8 bg-[#5B2EFF] rounded-full flex items-center justify-center shadow-lg hover:bg-[#5B2EFF] transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={16} className="text-white" />
              )}
            </button>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{userInfo.name}</h2>
          <div className="flex items-center justify-center space-x-1">
            <Star size={16} className="text-[#5B2EFF] fill-current" />
            <span className="text-[#5B2EFF] font-medium">{userInfo.rating} Rating</span>
          </div>
        </div>
      </motion.div>

      {/* Update Account Banner */}
      <motion.div 
        className="mx-4 mb-6 bg-[#f3f0ff] dark:bg-[#241a4d] rounded-2xl p-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#5B2EFF] rounded-full flex items-center justify-center">
            <Shield className="text-white" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Let's update your account</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Improve your app experience</p>
            <p className="text-sm text-[#5B2EFF] font-medium mt-1">4 new suggestions</p>
          </div>
        </div>
      </motion.div>

      {/* Account Sections */}
      <ScrollableSection maxHeight="max-h-96">
        <div className="px-4 space-y-6 pb-24">
          {accountSections.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + sectionIndex * 0.1 }}
            >
              {section.title !== 'Account Actions' && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{section.title}</h3>
              )}
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm">
                {section.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.label}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        itemIndex !== section.items.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon 
                          size={20} 
                          className={item.danger ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'} 
                        />
                        <div className="text-left">
                          <p className={`font-medium ${item.danger ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                            {item.label}
                          </p>
                          {item.subtitle && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      {item.toggle ? (
                        <div
                          className={`w-12 h-6 rounded-full relative transition-colors ${
                            item.toggleOn ? 'bg-[#5B2EFF]' : 'bg-gray-200'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${
                              item.toggleOn ? 'left-6' : 'left-0.5'
                            }`}
                          ></div>
                        </div>
                      ) : (
                        <span className="text-gray-400">›</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollableSection>

      <BottomNavigation activeTab="account" />
    </div>
  );
};
