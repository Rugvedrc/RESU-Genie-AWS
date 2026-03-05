import time
import pyautogui

# Give yourself 3 seconds to switch to the target window
print("Switch to your target window now!")
for i in range(3, 0, -1):
    print(f"  Starting in {i}...")
    time.sleep(1)

# Step 1: Press Ctrl+L  (focuses address bar in most browsers, or clears terminal)
pyautogui.hotkey("ctrl", "l")
time.sleep(0.5)

# Step 2: Type "hi"
pyautogui.write("hi", interval=0.05)
time.sleep(0.2)

# Step 3: Press Enter
pyautogui.press("enter")

print("Done!")
