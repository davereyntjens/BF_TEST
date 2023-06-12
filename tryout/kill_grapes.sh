# kill all processes that have the word "grapes" in them
ps aux | grep grape | awk '{print $2}' | xargs -I {} kill {}