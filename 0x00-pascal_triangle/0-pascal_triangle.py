#!/usr/bin/python3
'''
Module of Pascal's triangle on range n
'''


def pascal_triangle(n):
    '''
    Returns a list of integers representing the Pascal's triangle of n
    '''

    if n <= 0:  # if n is not positive
        return []
    triangle = [[1]]  # initialization
    for i in range(1, n):
        row = [1]  # initialization
        for j in range(1, i):
            row.append(triangle[i-1][j-1] + triangle[i-1][j])
        row.append(1)
        triangle.append(row)
    return triangle
