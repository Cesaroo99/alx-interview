#!/usr/bin/python3
"""Script will unlock list of lists"""


def canUnlockAll(boxes):
    """This function will take a list of lists and the content
       of a list will unlok
    """

    k = [0]
    for key in k:
        for boxKey in boxes[key]:
            if boxKey not in k and boxKey < len(boxes):
                k.append(boxKey)
    if len(k) == len(boxes):
        return True
    return False
