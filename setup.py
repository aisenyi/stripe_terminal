# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in stripe_terminal/__init__.py
from stripe_terminal import __version__ as version

setup(
	name='stripe_terminal',
	version=version,
	description='Stripe Terminal Integration',
	author='Tridotstech',
	author_email='info@tridotstech.com',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
