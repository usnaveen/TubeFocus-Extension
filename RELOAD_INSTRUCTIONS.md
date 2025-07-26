# 🔄 Extension Reload Instructions

## 🚨 **IMPORTANT: You need to reload the extension!**

The extension has been updated to use the local Docker API instead of the Cloud Run endpoint. You need to reload the extension in Chrome for the changes to take effect.

## 📋 Steps to Reload:

### 1. **Open Chrome Extensions Page**
- Go to `chrome://extensions/` in your browser
- Or click the three dots menu → More tools → Extensions

### 2. **Find TubeFocus Extension**
- Look for "TubeFocus" in your extensions list
- Make sure "Developer mode" is enabled (toggle in top-right)

### 3. **Reload the Extension**
- Click the **🔄 Reload** button on the TubeFocus extension card
- Or click the refresh icon next to the extension

### 4. **Verify the Fix**
- The extension should now work without the JSON parsing errors
- Start a session and test on YouTube videos
- You should see the score display in the top-left corner

## 🔧 What Was Fixed:

### **Before (Broken):**
```javascript
const API_ENDPOINT = 'https://yt-scorer-49646986060.us-central1.run.app/predict';
```

### **After (Fixed):**
```javascript
const API_ENDPOINT = 'http://localhost:8080/predict';
```

### **Additional Changes:**
- ✅ Updated API request format to match local API
- ✅ Added required `X-API-KEY` header
- ✅ Fixed request body structure
- ✅ Updated response handling

## 🧪 Test the Fix:

1. **Start a session** in the extension popup
2. **Navigate to a YouTube video**
3. **Check for the score display** in top-left corner
4. **Click the score** to test feedback functionality
5. **Check browser console** - should see no more JSON errors

## 🎯 Expected Behavior:

- ✅ No more "Unexpected token '<'" errors
- ✅ Score display appears on YouTube videos
- ✅ Feedback modal opens when clicking score
- ✅ API calls work with local Docker container

## 🆘 If Still Having Issues:

1. **Check Docker container is running:**
   ```bash
   docker ps
   ```

2. **Test API directly:**
   ```bash
   curl http://localhost:8080/health
   ```

3. **Check browser console** for any new errors

4. **Restart Chrome** if needed

---

**The extension should now work perfectly with your local Docker API! 🎉** 