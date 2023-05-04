#!/usr/bin/python3

"""
    Method that determines the number of minmum operations given n characters
"""


def minOperations(n):
    """
        A function that calculates the fewest number of operations
        needed to give a result of exactly n H charactrs
        args: n: Number of characters to be displayed
        return:
               number of min operations
    """

    now = 1
    start = 0
    ctr = 0
    while now < n:
        remainder = n - now
        if (remainder % now == 0):
            start = now
            now += start
            ctr += 2
        else:
            now += start
            ctr += 1
    return ctr
