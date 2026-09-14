import numpy as np
a=2
b=4
c=5
h=1
g=3
f=2

A=np.array([[a,h,g],
[h,b,f],
[g,f,c]],
dtype=float)

print("Matrix obtained from the quadratic form:")
print(A)

eigenvalues,eigenvectors=np.linalg.eigh(A)
print("\n Eigen Values:")
print(eigenvalues)
print("\nOrthogonal Matrix P:")
print(eigenvectors)
D=np.diag(eigenvalues)
print("\n Diagonal Matrix D:")

