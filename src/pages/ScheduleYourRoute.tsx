import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, MapPin, Clock, Navigation, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollableSection } from '../components/ScrollableSection';
import { useGeolocation } from '../hooks/useGeolocation';
import { getAddressSuggestions } from '../data/addressSuggestions';

export const ScheduleYourRoute: React.FC = () => {
  const navigate = useNavigate();
  const { address: currentLocation, loading: locationLoading } = useGeolocation();
  
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | number>('destination');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState(getAddressSuggestions(''));

  useEffect(() => {
    if (currentLocation && !pickup) {
      setPickup(currentLocation);
    }
  }, [currentLocation, pickup]);

  useEffect(() => {
    // Auto-highlight destination field on component mount
    setActiveField('destination');
  }, []);
  useEffect(() => {
    setSuggestions(getAddressSuggestions(searchQuery));
  }, [searchQuery]);

  // Function to find the next empty field
  const getNextEmptyField = (): 'pickup' | 'destination' | number | null => {
    if (!pickup) return 'pickup';
    if (!destination) return 'destination';
    
    // Check for empty stops
    for (let i = 0; i < stops.length; i++) {
      if (!stops[i] || stops[i].trim() === '') {
        return i;
      }
    }
    
    return null; // No empty fields
  };

  // Function to check if all required fields are filled
  const areAllFieldsFilled = (): boolean => {
    const hasPickup = pickup && pickup.trim() !== '';
    const hasDestination = destination && destination.trim() !== '';
    const allStopsFilled = stops.length === 0 || stops.every(stop => stop && stop.trim() !== '');
    
    return hasPickup && hasDestination && allStopsFilled;
  };
  const handleFieldFocus = (field: 'pickup' | 'destination' | number) => {
    setActiveField(field);
    if (field === 'pickup') {
      setSearchQuery(pickup);
    } else if (field === 'destination') {
      setSearchQuery(destination);
    } else {
      setSearchQuery(stops[field] || '');
    }
  };

  const handleSuggestionSelect = (address: string) => {
    if (activeField === 'pickup') {
      setPickup(address);
    } else if (activeField === 'destination') {
      setDestination(address);
    } else if (typeof activeField === 'number') {
      const newStops = [...stops];
      newStops[activeField] = address;
      setStops(newStops);
    }
    
    setSearchQuery('');
    
    // Auto-navigate to next empty field or complete the route
    setTimeout(() => {
      const nextField = getNextEmptyField();
      
      if (nextField !== null) {
        // Move to next empty field
        setActiveField(nextField);
        if (nextField === 'pickup') {
          setSearchQuery(pickup);
        } else if (nextField === 'destination') {
          setSearchQuery(destination);
        } else {
          setSearchQuery(stops[nextField] || '');
        }
      } else if (areAllFieldsFilled()) {
        // All fields filled, navigate to schedule confirm (payment method)
        navigate('/schedule-confirm', {
          state: {
            pickup,
            destination,
            stops
          }
        });
      }
    }, 100);
  };

  const handleAddStop = () => {
    if (stops.length < 3) {
      const newStops = [...stops, ''];
      setStops(newStops);
      setActiveField(newStops.length - 1);
      setSearchQuery('');
    }
  };

  const handleRemoveStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
    
    // If we removed the active field, move to destination or next empty field
    if (activeField === index) {
      const nextField = getNextEmptyField();
      setActiveField(nextField || 'destination');
    }
  };

  const handleInputChange = (value: string) => {
    if (activeField === 'pickup') {
      setPickup(value);
    } else if (activeField === 'destination') {
      setDestination(value);
    } else if (typeof activeField === 'number') {
      const newStops = [...stops];
      newStops[activeField] = value;
      setStops(newStops);
    }
    
    setSearchQuery(value);
  };

  const getPlaceholder = (field: 'pickup' | 'destination' | number) => {
    if (field === 'pickup') return 'Search pick-up location';
    if (field === 'destination') return 'Destination';
    return 'Add stop';
  };

  // Function to determine if a field should have the green glow
  const isFieldActive = (field: 'pickup' | 'destination' | number): boolean => {
    return activeField === field;
  };
  return (
    <motion.div 
      className="min-h-screen bg-gray-50 dark:bg-gray-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="bg-white dark:bg-gray-900 p-4 shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-800 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Schedule your ride</h1>
        </div>
      </motion.div>

      {/* Route Form */}
      <motion.div 
        className="p-4 pt-8 space-y-4"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Pickup Location */}
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-[#5B2EFF] rounded-full flex-shrink-0"></div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={pickup}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => handleFieldFocus('pickup')}
              placeholder={locationLoading ? 'Getting your location...' : getPlaceholder('pickup')}
              className={`w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all ${
                isFieldActive('pickup') 
                  ? 'ring-2 ring-[#5B2EFF] bg-white dark:bg-gray-700 shadow-lg shadow-[#5B2EFF]/20 border-2 border-[#5B2EFF]' 
                  : 'focus:ring-2 focus:ring-[#5B2EFF] focus:bg-white dark:focus:bg-gray-700'
              }`}
              disabled={locationLoading}
            />
            {pickup && activeField === 'pickup' && (
              <button
                onClick={() => {
                  setPickup('');
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center"
              >
                <X size={14} className="text-gray-600 dark:text-gray-300" />
              </button>
            )}
          </div>
          <button
            onClick={handleAddStop}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            disabled={stops.length >= 3}
          >
            <Plus size={20} className={stops.length >= 3 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300'} />
          </button>
        </div>

        {/* Add Stops */}
        <AnimatePresence>
          {stops.map((stop, index) => (
            <motion.div
              key={index}
              className="flex items-center space-x-3 ml-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-3 h-3 bg-[#5B2EFF] rounded-full flex-shrink-0"></div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={stop}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => handleFieldFocus(index)}
                  placeholder={getPlaceholder(index)}
                  className={`w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all ${
                    isFieldActive(index) 
                      ? 'ring-2 ring-[#5B2EFF] bg-white dark:bg-gray-700 shadow-lg shadow-[#5B2EFF]/20 border-2 border-[#5B2EFF]' 
                      : 'focus:ring-2 focus:ring-[#5B2EFF] focus:bg-white dark:focus:bg-gray-700'
                  }`}
                />
              </div>
              <button
                onClick={() => handleRemoveStop(index)}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={16} className="text-red-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Destination */}
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={destination}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => handleFieldFocus('destination')}
              placeholder={getPlaceholder('destination')}
              className={`w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all ${
                isFieldActive('destination') 
                  ? 'ring-2 ring-[#5B2EFF] bg-white dark:bg-gray-700 shadow-lg shadow-[#5B2EFF]/20 border-2 border-[#5B2EFF]' 
                  : 'focus:ring-2 focus:ring-[#5B2EFF] focus:bg-white dark:focus:bg-gray-700'
              }`}
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          </div>
          <div className="w-10 flex items-center justify-center">
            <div className="flex flex-col space-y-1">
              <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Address Suggestions */}
        <ScrollableSection maxHeight="max-h-96">
          <div className="space-y-2 mt-6">
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion.id}
                onClick={() => handleSuggestionSelect(suggestion.address)}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Clock className="text-gray-400 dark:text-gray-500 flex-shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{suggestion.address}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{suggestion.description}</p>
                </div>
                {suggestion.distance && (
                  <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">{suggestion.distance}</span>
                )}
              </motion.button>
            ))}
            
            {/* My Location Option */}
            <motion.button
              onClick={() => handleSuggestionSelect(currentLocation || 'Current Location')}
              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: suggestions.length * 0.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Navigation className="text-[#5B2EFF] flex-shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#5B2EFF]">My location</p>
                {currentLocation && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{currentLocation}</p>
                )}
              </div>
            </motion.button>
          </div>
        </ScrollableSection>
      </motion.div>
    </motion.div>
  );
};
