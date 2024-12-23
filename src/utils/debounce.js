/**
 * Debounces a function call by delaying its execution until after a specified delay has elapsed since the last time it was invoked.
 *
 * @param {Object} debounceTimers - An object to store debounce timers for different events.
 * @param {string} eventName - The name of the event to debounce.
 * @param {() => void} callback - The function to be debounced.
 * @param {number} delay - The delay in milliseconds to wait before executing the callback.
 */
function debounce(debounceTimers, eventName, callback, delay) {
  if (debounceTimers[eventName]) {
    clearTimeout(debounceTimers[eventName]);
  }

  debounceTimers[eventName] = setTimeout(callback, delay);
}

module.exports = debounce;
