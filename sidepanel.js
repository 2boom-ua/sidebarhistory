// Sidebar History - Chrome/Edge Extension
// Copyright 2boom, 2026

console.log('sidepanel.js loaded');

function getMessage(key) {
  var result = chrome.i18n.getMessage(key);
  if (!result) {
    // Fallback messages
    var fallback = {
      'searchPlaceholder': 'Search history...',
      'openHistoryTooltip': 'Open history page',
      'shareTooltip': 'Share link',
      'copyTooltip': 'Copy link',
      'deleteTooltip': 'Delete',
      'loadingText': 'Loading history...',
      'nothingFound': 'Nothing found',
      'itemDeleted': 'Item deleted',
      'copied': 'Copied!',
      'searchMinChars': 'Enter 3+ characters to search',
      'groupRecent': 'Recent',
      'groupToday': 'Today',
      'groupYesterday': 'Yesterday',
      'groupEarlierThisWeek': 'Earlier this week',
      'groupLastWeek': 'Last week',
      'groupEarlier': 'Earlier',
      'daySunday': 'Sunday',
      'dayMonday': 'Monday',
      'dayTuesday': 'Tuesday',
      'dayWednesday': 'Wednesday',
      'dayThursday': 'Thursday',
      'dayFriday': 'Friday',
      'daySaturday': 'Saturday',
      'monthJanuary': 'January',
      'monthFebruary': 'February',
      'monthMarch': 'March',
      'monthApril': 'April',
      'monthMay': 'May',
      'monthJune': 'June',
      'monthJuly': 'July',
      'monthAugust': 'August',
      'monthSeptember': 'September',
      'monthOctober': 'October',
      'monthNovember': 'November',
      'monthDecember': 'December'
    };
    return fallback[key] || key;
  }
  return result;
}

// Filter rules
const filterRules = [
  function(item) {
    return !item.url.startsWith('chrome://') && 
           !item.url.startsWith('edge://') && 
           !item.url.startsWith('about:') && 
           !item.url.startsWith('chrome-extension://') && 
           !item.url.startsWith('data:');
  },
  function(item) {
    return !item.url.includes('localhost') && 
           !item.url.includes('127.0.0.1') && 
           !item.url.includes('192.168.') && 
           !item.url.includes('10.') && 
           !item.url.includes('172.16.') && 
           !item.url.includes('172.17.') && 
           !item.url.includes('172.18.') && 
           !item.url.includes('172.19.') && 
           !item.url.includes('172.20.') && 
           !item.url.includes('172.21.') && 
           !item.url.includes('172.22.') && 
           !item.url.includes('172.23.') && 
           !item.url.includes('172.24.') && 
           !item.url.includes('172.25.') && 
           !item.url.includes('172.26.') && 
           !item.url.includes('172.27.') && 
           !item.url.includes('172.28.') && 
           !item.url.includes('172.29.') && 
           !item.url.includes('172.30.') && 
           !item.url.includes('172.31.');
  },
  function(item) {
    return item.title || item.url;
  },
  function(item) {
    return !item.url.includes('newtab') && 
           !item.url.includes('new-tab') && 
           !item.url.includes('startpage') && 
           !item.url.includes('search?') &&
           !item.title.includes('New Tab') &&
           !item.title.includes('Start Page');
  }
];

// Normalize URL: keep only domain + path, remove params and hash
function normalizeUrl(url) {
  try {
    var urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (e) {
    var parts = url.split('?')[0].split('#')[0];
    return parts;
  }
}

// Cached history items
var cachedHistoryItems = [];

// Function to load history into cache with specified days
function loadHistoryToCache(days) {
  var startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  return new Promise(function(resolve, reject) {
    chrome.history.search({ text: '', maxResults: 50000, startTime: startTime }, function(items) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      // Apply filters
      items = items.filter(function(item) {
        for (var i = 0; i < filterRules.length; i++) {
          if (!filterRules[i](item)) {
            return false;
          }
        }
        return true;
      });

      // Remove duplicates by normalized URL, keep the latest visit
      var uniqueItems = {};
      items.forEach(function(item) {
        var normalizedUrl = normalizeUrl(item.url);
        if (!uniqueItems[normalizedUrl] || item.lastVisitTime > uniqueItems[normalizedUrl].lastVisitTime) {
          uniqueItems[normalizedUrl] = item;
        }
      });
      items = Object.values(uniqueItems);

      // Sort by lastVisitTime descending
      items.sort(function(a, b) {
        return b.lastVisitTime - a.lastVisitTime;
      });

      cachedHistoryItems = items;
      resolve(items);
    });
  });
}

// Helper function to process history items (filters + deduplication + sort)
function processHistoryItems(items) {
  // Apply filters
  items = items.filter(function(item) {
    for (var i = 0; i < filterRules.length; i++) {
      if (!filterRules[i](item)) {
        return false;
      }
    }
    return true;
  });

  // Remove duplicates by normalized URL, keep the latest visit
  var uniqueItems = {};
  items.forEach(function(item) {
    var normalizedUrl = normalizeUrl(item.url);
    if (!uniqueItems[normalizedUrl] || item.lastVisitTime > uniqueItems[normalizedUrl].lastVisitTime) {
      uniqueItems[normalizedUrl] = item;
    }
  });
  items = Object.values(uniqueItems);

  // Sort by lastVisitTime descending
  items.sort(function(a, b) {
    return b.lastVisitTime - a.lastVisitTime;
  });

  return items;
}

// Search history - always search by title AND url together across all history
function searchHistoryAll(query) {
  return new Promise(function(resolve, reject) {
    var lowerQuery = query.toLowerCase();
    
    // Load all items without time limit (startTime: 0) and max results
    chrome.history.search({ text: '', maxResults: 100000, startTime: 0 }, function(items) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      // Manual filtering by title and URL
      items = items.filter(function(item) {
        var titleMatch = item.title && item.title.toLowerCase().includes(lowerQuery);
        var urlMatch = item.url && item.url.toLowerCase().includes(lowerQuery);
        return titleMatch || urlMatch;
      });
      
      // Process items (filters + deduplication + sort)
      items = processHistoryItems(items);
      resolve(items);
    });
  });
}

function getDateGroupKey(timestamp, maxTimestamp) {
  var oneHourAgo = maxTimestamp - (60 * 60 * 1000);
  
  if (timestamp > oneHourAgo) return 'groupRecent';
  
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  var weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  var monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  var date = new Date(timestamp);
  var dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'groupToday';
  if (dateOnly.getTime() === yesterday.getTime()) return 'groupYesterday';
  if (dateOnly.getTime() > weekAgo.getTime()) return 'groupEarlierThisWeek';
  if (dateOnly.getTime() > monthAgo.getTime()) return 'groupLastWeek';
  return 'groupEarlier';
}

function getDateGroupLabel(timestamp, maxTimestamp) {
  var key = getDateGroupKey(timestamp, maxTimestamp);
  var label = getMessage(key);
  
  // For Recent group, show only label without date
  if (key === 'groupRecent') {
    return label;
  }
  
  var date = new Date(timestamp);
  var days = [
    getMessage('daySunday'),
    getMessage('dayMonday'),
    getMessage('dayTuesday'),
    getMessage('dayWednesday'),
    getMessage('dayThursday'),
    getMessage('dayFriday'),
    getMessage('daySaturday')
  ];
  var months = [
    getMessage('monthJanuary'),
    getMessage('monthFebruary'),
    getMessage('monthMarch'),
    getMessage('monthApril'),
    getMessage('monthMay'),
    getMessage('monthJune'),
    getMessage('monthJuly'),
    getMessage('monthAugust'),
    getMessage('monthSeptember'),
    getMessage('monthOctober'),
    getMessage('monthNovember'),
    getMessage('monthDecember')
  ];
  var fullDate = days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
  return label + ' - ' + fullDate;
}

// Show toast notification
function showToast(message) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
  }, 2000);
}

// Position tooltip
function positionTooltip(element, tooltip) {
  var rect = element.getBoundingClientRect();
  var tooltipHeight = tooltip.offsetHeight || 30;
  var spaceBelow = window.innerHeight - rect.bottom;
  var spaceAbove = rect.top;
  
  // Reset positions
  tooltip.style.top = 'auto';
  tooltip.style.bottom = 'auto';
  tooltip.style.transform = 'translateX(-50%)';
  
  if (spaceBelow < tooltipHeight + 10 && spaceAbove > tooltipHeight + 10) {
    tooltip.style.bottom = '100%';
    tooltip.style.top = 'auto';
  } else {
    tooltip.style.top = '100%';
    tooltip.style.bottom = 'auto';
  }
  
  // Horizontal positioning
  var tooltipWidth = tooltip.offsetWidth || 100;
  var leftPos = rect.left + (rect.width / 2);
  var rightEdge = leftPos + (tooltipWidth / 2);
  var leftEdge = leftPos - (tooltipWidth / 2);
  
  if (rightEdge > window.innerWidth - 10) {
    var shift = rightEdge - window.innerWidth + 10;
    tooltip.style.transform = 'translateX(calc(-50% - ' + shift + 'px))';
  } else if (leftEdge < 10) {
    var shift = 10 - leftEdge;
    tooltip.style.transform = 'translateX(calc(-50% + ' + shift + 'px))';
  }
}

function renderHistory(items, listElement) {
  console.log('renderHistory called with items:', items.length);
  listElement.innerHTML = '';
  
  // Find max timestamp (most recent visit)
  var maxTimestamp = 0;
  items.forEach(function(item) {
    if (item.lastVisitTime > maxTimestamp) {
      maxTimestamp = item.lastVisitTime;
    }
  });
  
  // Group items by date
  var groups = {};
  items.forEach(function(item) {
    var groupKey = getDateGroupKey(item.lastVisitTime, maxTimestamp);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  });
  
  console.log('Groups found:', Object.keys(groups));
  console.log('Group details:', groups);

  // Order of groups - use keys instead of localized names
  var groupOrderKeys = ['groupRecent', 'groupToday', 'groupYesterday', 'groupEarlierThisWeek', 'groupLastWeek', 'groupEarlier'];

  // Render groups
  groupOrderKeys.forEach(function(groupKey) {
    if (groups[groupKey] && groups[groupKey].length > 0) {
      console.log('Rendering group:', groupKey, 'with', groups[groupKey].length, 'items');
      // Get localized label from first item
      var label = getDateGroupLabel(groups[groupKey][0].lastVisitTime, maxTimestamp);
      // Add group header
      var header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = label;
      listElement.appendChild(header);

      // Render items in this group
      groups[groupKey].forEach(function(item, index) {
        var li = document.createElement('li');
        
        if (index === 0) {
          li.classList.add('first-in-group');
        }
        
        if (index === groups[groupKey].length - 1) {
          li.classList.add('last-in-group');
        }

        // Title
        var title = item.title || item.url;

        // Time (only HH:MM)
        var date = new Date(item.lastVisitTime);
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        var timeStr = hours + ':' + minutes;

        // Favicon
        var faviconImg = document.createElement('img');
        faviconImg.className = 'favicon';
        try {
          var domain = new URL(item.url).hostname;
          faviconImg.src = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=16';
        } catch (e) {
          faviconImg.src = 'icons/favicon-default.svg';
        }
        faviconImg.onerror = function() {
          this.src = 'icons/favicon-default.svg';
        };

        // Link
        var linkContainer = document.createElement('span');
        linkContainer.className = 'link-container';
        var link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.textContent = title;
        linkContainer.appendChild(link);

        // Time
        var timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.textContent = timeStr;

        // Action buttons container
        var actionButtons = document.createElement('span');
        actionButtons.className = 'action-buttons';

        // Share button
        var shareBtn = document.createElement('button');
        shareBtn.className = 'action-btn';
        
        var shareIcon = document.createElement('img');
        shareIcon.src = 'icons/share.svg';
        shareIcon.alt = 'Share';
        shareBtn.appendChild(shareIcon);

        var shareTooltip = document.createElement('span');
        shareTooltip.className = 'tooltip';
        shareTooltip.textContent = getMessage('shareTooltip');
        shareBtn.appendChild(shareTooltip);

        shareBtn.addEventListener('mouseenter', function(e) {
          e.stopPropagation();
          shareTooltip.classList.add('show');
        });

        shareBtn.addEventListener('mouseleave', function(e) {
          e.stopPropagation();
          shareTooltip.classList.remove('show');
        });

        shareBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (navigator.share) {
            navigator.share({
              title: title,
              url: item.url
            }).catch(function(err) {
              console.log('Share canceled:', err);
            });
          }
        });

        // Copy button
        var copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        
        var copyIcon = document.createElement('img');
        copyIcon.src = 'icons/copy.svg';
        copyIcon.alt = 'Copy';
        copyBtn.appendChild(copyIcon);

        var copyTooltip = document.createElement('span');
        copyTooltip.className = 'tooltip';
        copyTooltip.textContent = getMessage('copyTooltip');
        copyBtn.appendChild(copyTooltip);

        copyBtn.addEventListener('mouseenter', function(e) {
          e.stopPropagation();
          copyTooltip.classList.add('show');
        });

        copyBtn.addEventListener('mouseleave', function(e) {
          e.stopPropagation();
          copyTooltip.classList.remove('show');
        });

        copyBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          navigator.clipboard.writeText(item.url).then(function() {
            var originalText = copyTooltip.textContent;
            copyTooltip.textContent = getMessage('copied');
            setTimeout(function() {
              copyTooltip.textContent = originalText;
            }, 1000);
          });
        });

        // Delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn';
        
        var deleteIcon = document.createElement('img');
        deleteIcon.src = 'icons/delete.svg';
        deleteIcon.alt = 'Delete';
        deleteBtn.appendChild(deleteIcon);

        var deleteTooltip = document.createElement('span');
        deleteTooltip.className = 'tooltip';
        deleteTooltip.textContent = getMessage('deleteTooltip');
        deleteBtn.appendChild(deleteTooltip);

        deleteBtn.addEventListener('mouseenter', function(e) {
          e.stopPropagation();
          deleteTooltip.classList.add('show');
        });

        deleteBtn.addEventListener('mouseleave', function(e) {
          e.stopPropagation();
          deleteTooltip.classList.remove('show');
        });

        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          chrome.history.deleteUrl({ url: item.url }, function() {
            showToast(getMessage('itemDeleted'));
            // Update cache and reload
            loadHistoryToCache(3).then(function() {
              displayHistory('');
            });
          });
        });

        actionButtons.appendChild(shareBtn);
        actionButtons.appendChild(copyBtn);
        actionButtons.appendChild(deleteBtn);

        // URL tooltip
        var urlTooltip = document.createElement('span');
        urlTooltip.className = 'url-tooltip';
        urlTooltip.textContent = item.url;
        li.appendChild(urlTooltip);

        var tooltipTimer = null;

        function showUrlTooltip() {
          if (tooltipTimer) {
            clearTimeout(tooltipTimer);
            tooltipTimer = null;
          }
          positionTooltip(li, urlTooltip);
          urlTooltip.classList.add('show');
        }

        function hideUrlTooltip() {
          if (tooltipTimer) {
            clearTimeout(tooltipTimer);
            tooltipTimer = null;
          }
          urlTooltip.classList.remove('show');
        }

        li.addEventListener('mouseenter', function(e) {
          e.stopPropagation();
          tooltipTimer = setTimeout(function() {
            showUrlTooltip();
          }, 400);
        });

        li.addEventListener('mouseleave', function(e) {
          e.stopPropagation();
          hideUrlTooltip();
        });

        // Hide URL tooltip when hovering over action buttons
        actionButtons.addEventListener('mouseenter', function(e) {
          e.stopPropagation();
          hideUrlTooltip();
        });

        actionButtons.addEventListener('mouseleave', function(e) {
          e.stopPropagation();
          // Show URL tooltip again if li is still hovered
          if (li.matches(':hover')) {
            showUrlTooltip();
          }
        });

        li.appendChild(faviconImg);
        li.appendChild(linkContainer);
        li.appendChild(timeSpan);
        li.appendChild(actionButtons);
        listElement.appendChild(li);
      });
    }
  });
}

// Display history from cache with optional filter
function displayHistory(query) {
  const listElement = document.getElementById('history-list');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  if (cachedHistoryItems.length === 0) {
    loadingIndicator.style.display = 'none';
    listElement.innerHTML = '<li>' + getMessage('nothingFound') + '</li>';
    return;
  }

  var items = cachedHistoryItems;

  // If search query is present, filter manually
  if (query && query.trim() !== '') {
    var lowerQuery = query.toLowerCase();
    items = items.filter(function(item) {
      var titleMatch = item.title && item.title.toLowerCase().includes(lowerQuery);
      var urlMatch = item.url && item.url.toLowerCase().includes(lowerQuery);
      return titleMatch || urlMatch;
    });
  }

  loadingIndicator.style.display = 'none';

  if (items.length === 0) {
    listElement.innerHTML = '<li>' + getMessage('nothingFound') + '</li>';
    return;
  }

  renderHistory(items, listElement);
}

// Function to load and display history
function loadHistory(query = '') {
  console.log('loadHistory called with query:', query);
  const listElement = document.getElementById('history-list');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  // If cache is empty, load it
  if (cachedHistoryItems.length === 0) {
    listElement.innerHTML = '';
    loadingIndicator.style.display = 'block';
    loadHistoryToCache(3).then(function() {
      displayHistory(query);
      // After initial load, load more history in background (14 days)
      setTimeout(function() {
        loadHistoryToCache(14).then(function() {
          // Only update if no search query is active
          if (!query || query.trim() === '') {
            displayHistory('');
          }
        });
      }, 1500);
    }).catch(function(error) {
      console.error('Failed to load history:', error);
      loadingIndicator.style.display = 'none';
      listElement.innerHTML = '<li>Error loading history</li>';
    });
  } else {
    displayHistory(query);
  }
}

// Search with debounce and min chars
var searchDebounceTimer = null;

function handleSearchInput(query) {
  const listElement = document.getElementById('history-list');
  
  // Clear previous timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  
  // If query is empty, show all history
  if (query.length === 0) {
    loadHistory('');
    return;
  }
  
  // If 1-2 characters, show message
  if (query.length < 3) {
    listElement.innerHTML = '<li style="text-align:center;color:var(--time-color);padding:20px;">' + getMessage('searchMinChars') + '</li>';
    return;
  }
  
  // If 3+ characters, debounce search
  searchDebounceTimer = setTimeout(function() {
    // Search across all history
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';
    
    searchHistoryAll(query).then(function(items) {
      loadingIndicator.style.display = 'none';
      const listElement = document.getElementById('history-list');
      if (items.length === 0) {
        listElement.innerHTML = '<li>' + getMessage('nothingFound') + '</li>';
        return;
      }
      renderHistory(items, listElement);
    }).catch(function(error) {
      console.error('Search failed:', error);
      loadingIndicator.style.display = 'none';
      listElement.innerHTML = '<li>Search error</li>';
    });
    
    searchDebounceTimer = null;
  }, 250);
}

// Load history when the sidebar is opened
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded fired');

  // Set localized texts
  document.getElementById('search').placeholder = getMessage('searchPlaceholder');
  document.getElementById('loadingIndicator').textContent = getMessage('loadingText');

  // Clear search button
  var clearBtn = document.getElementById('clearSearchBtn');
  var searchInput = document.getElementById('search');
  
  searchInput.addEventListener('input', function() {
    var query = this.value;
    
    // Show/hide clear button
    if (query.length > 0) {
      clearBtn.classList.add('visible');
    } else {
      clearBtn.classList.remove('visible');
    }
    
    handleSearchInput(query);
  });
  
  clearBtn.addEventListener('click', function() {
    searchInput.value = '';
    clearBtn.classList.remove('visible');
    searchInput.focus();
    handleSearchInput('');
  });
  
  // Load history
  loadHistory('');
});

// Reposition URL tooltips on window resize
window.addEventListener('resize', function() {
  document.querySelectorAll('.url-tooltip.show').forEach(function(tooltip) {
    var parent = tooltip.closest('li');
    if (parent) {
      positionTooltip(parent, tooltip);
    }
  });
});

// Position button tooltip to prevent overflow
function positionButtonTooltip(button, tooltip) {
  var rect = button.getBoundingClientRect();
  var tooltipWidth = tooltip.offsetWidth || 100;
  var leftPos = rect.left + (rect.width / 2);
  var rightEdge = leftPos + (tooltipWidth / 2);
  
  // Reset transform
  tooltip.style.transform = 'translateX(-50%)';
  
  if (rightEdge > window.innerWidth - 10) {
    var shift = rightEdge - window.innerWidth + 10;
    tooltip.style.transform = 'translateX(calc(-50% - ' + shift + 'px))';
  }
}

// Export all history to CSV
function exportHistory() {
  chrome.history.search({ text: '', maxResults: 100000, startTime: 0 }, function(items) {
    if (chrome.runtime.lastError) {
      showToast('Error loading history');
      return;
    }
    
    if (items.length === 0) {
      showToast('No history to export');
      return;
    }
    
    // Build CSV
    var csv = '"Title","URL","Date","Time"\n';
    items.forEach(function(item) {
      var title = (item.title || '').replace(/"/g, '""');
      var url = (item.url || '').replace(/"/g, '""');
      var date = new Date(item.lastVisitTime);
      var dateStr = date.getFullYear() + '-' + 
                    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(date.getDate()).padStart(2, '0');
      var timeStr = String(date.getHours()).padStart(2, '0') + ':' + 
                    String(date.getMinutes()).padStart(2, '0') + ':' + 
                    String(date.getSeconds()).padStart(2, '0');
      csv += '"' + title + '","' + url + '","' + dateStr + '","' + timeStr + '"\n';
    });
    
    // Create and download file
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var now = new Date();
    var filename = 'history_export_' + 
                   now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(now.getDate()).padStart(2, '0') + '.csv';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Exported ' + items.length + ' items');
  });
}